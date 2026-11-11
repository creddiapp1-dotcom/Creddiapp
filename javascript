// Configuración de Supabase
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let operadoraSeleccionada = 'Digitel';

// Alternar pestañas de autenticación
function cambiarAuthTab(tipo) {
    const btnLogin = document.getElementById('btn-tab-login');
    const btnRegister = document.getElementById('btn-tab-register');
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');

    if (tipo === 'login') {
        btnLogin.className = "flex-1 py-2 text-xs font-bold rounded-lg bg-teal-600 text-white transition";
        btnRegister.className = "flex-1 py-2 text-xs font-bold rounded-lg text-slate-400 transition";
        formLogin.classList.remove('hidden');
        formRegister.classList.add('hidden');
    } else {
        btnRegister.className = "flex-1 py-2 text-xs font-bold rounded-lg bg-teal-600 text-white transition";
        btnLogin.className = "flex-1 py-2 text-xs font-bold rounded-lg text-slate-400 transition";
        formRegister.classList.remove('hidden');
        formLogin.classList.add('hidden');
    }
}

// Registrar cuenta en Supabase y subir foto de cédula al Storage
async function handleRegister(e) {
    e.preventDefault();
    const nombre = document.getElementById('reg-nombre').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const fileInput = document.getElementById('reg-cedula-file');
    const file = fileInput.files[0];

    if (!file) {
        alert("Por favor selecciona la foto de la cédula.");
        return;
    }

    try {
        // Subir foto al bucket 'cedulas'
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${email.replace(/[^a-zA-Z0-9]/g, '_')}.${fileExt}`;
        const { data: storageData, error: storageError } = await _supabase.storage
            .from('cedulas')
            .upload(fileName, file);

        let cedulaUrl = '';
        if (!storageError) {
            const { data: urlData } = _supabase.storage.from('cedulas').getPublicUrl(fileName);
            cedulaUrl = urlData.publicUrl;
        }

        // Guardar usuario en la tabla 'usuarios'
        const { error: dbError } = await _supabase.from('usuarios').insert([
            {
                nombre: nombre,
                email: email,
                password: password,
                cedula_foto_url: cedulaUrl,
                status: 'pendiente_aprobacion'
            }
        ]);

        if (dbError) throw dbError;

        alert("¡Cuenta creada con éxito! Ahora puedes iniciar sesión.");
        cambiarAuthTab('login');
        document.getElementById('form-register').reset();

    } catch (err) {
        console.error(err);
        alert("Error al registrar: " + (err.message || "Inténtalo de nuevo."));
    }
}

// Iniciar sesión desde Supabase
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    const { data, error } = await _supabase
        .from('usuarios')
        .select('*')
        .eq('email', email)
        .eq('password', password)
        .single();

    if (error || !data) {
        alert("Correo o contraseña incorrectos.");
    } else {
        localStorage.setItem('creddi_user', JSON.stringify(data));
        cargarSesionUsuario(data);
    }
}

// Cargar sesión
function cargarSesionUsuario(usuario) {
    document.getElementById('view-auth').classList.add('hidden');
    document.getElementById('bottom-nav').classList.remove('hidden');
    
    document.getElementById('user-display-name').textContent = usuario.nombre || 'Usuario';
    document.getElementById('profile-name').textContent = usuario.nombre || 'Usuario';
    document.getElementById('profile-email').textContent = usuario.email || '';

    cambiarVista('inicio');
}

// Cerrar sesión
function cerrarSesion() {
    localStorage.removeItem('creddi_user');
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.getElementById('view-auth').classList.remove('hidden');
    document.getElementById('bottom-nav').classList.add('hidden');
}

// Cambiar vistas
function cambiarVista(nombreVista) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.getElementById(`view-${nombreVista}`).classList.remove('hidden');

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('text-teal-400');
        btn.classList.add('text-slate-400');
        if(btn.getAttribute('data-target') === nombreVista) {
            btn.classList.remove('text-slate-400');
            btn.classList.add('text-teal-400');
        }
    });
    window.scrollTo(0, 0);
}

// Operadora
function seleccionarOperadora(op, btnElement) {
    operadoraSeleccionada = op;
    document.querySelectorAll('.op-btn').forEach(b => {
        b.classList.remove('border-emerald-500', 'bg-emerald-500/10');
        b.classList.add('border-slate-800', 'bg-slate-950');
    });
    btnElement.classList.remove('border-slate-800', 'bg-slate-950');
    btnElement.classList.add('border-emerald-500', 'bg-emerald-500/10');
}

// Comisión
document.getElementById('rec-amount')?.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value) || 0;
    const comision = val * 0.10;
    const total = val + comision;
    document.getElementById('lbl-comision').textContent = comision.toFixed(2) + ' Bs';
    document.getElementById('lbl-total').textContent = total.toFixed(2) + ' Bs';
});

// Copiar datos de pago móvil
function copiarDatosPago() {
    const texto = "Banco: 0104 - Banco Venezolano de Crédito\nTeléfono: 0412-6707872\nCédula/RIF: V-31.540.415";
    navigator.clipboard.writeText(texto).then(() => {
        alert("¡Datos de pago copiados al portapapeles!");
    });
}

// Recargas a Supabase
document.getElementById('recharge-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = document.getElementById('rec-phone').value;
    const amount = document.getElementById('rec-amount').value;
    const usuarioSesion = JSON.parse(localStorage.getItem('creddi_user') || '{}');

    const { error } = await _supabase.from('recargas').insert([
        { 
            operadora: operadoraSeleccionada, 
            phone: phone, 
            amount: amount, 
            usuario_email: usuarioSesion.email || 'Anónimo',
            status: 'pendiente_manual' 
        }
    ]);

    if (error) {
        alert("Hubo un error al registrar la recarga.");
        console.error(error);
    } else {
        alert("¡Solicitud de recarga enviada con éxito! Será atendida manualmente.");
        document.getElementById('recharge-form').reset();
        document.getElementById('lbl-comision').textContent = '0.00 Bs';
        document.getElementById('lbl-total').textContent = '0.00 Bs';
    }
});

// Mantener sesión activa
window.addEventListener('DOMContentLoaded', () => {
    const sesionGuardada = localStorage.getItem('creddi_user');
    if (sesionGuardada) {
        cargarSesionUsuario(JSON.parse(sesionGuardada));
    }
});
