// --- НАСТРОЙКА SUPABASE ---
const SUPABASE_URL = 'https://texytgcdtafeejqxftqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRleHl0Z2NkdGFmZWVqcXhmdHFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1NTM2MjUsImV4cCI6MjA3MjEyOTYyNX0.1hWMcDYm4JdWjDKTvS_7uBatorByAK6RtN9LYljpacc';

// ИСПРАВЛЕНИЕ: Мы создаем клиент, обращаясь к глобальному объекту supabase из подключенного скрипта
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- ЭЛЕМЕНТЫ DOM ---
const loginForm = document.getElementById('login-form');
const errorMessage = document.getElementById('error-message');

// --- ОБРАБОТЧИК ФОРМЫ ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    // Сбрасываем сообщение об ошибке
    errorMessage.textContent = '';

    // Используем наш созданный клиент
    const { error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) {
        errorMessage.textContent = 'Неверный email или пароль. Попробуйте снова.';
        console.error('Ошибка входа:', error.message);
    } else {
        // В случае успеха перенаправляем на главную страницу
        window.location.href = 'index.html';
    }
});