// --- ЭЛЕМЕНТЫ DOM ГЛАВНОЙ СТРАНИЦЫ ---
const recentTracksContainer = document.getElementById('recent-tracks-container');
const profileLink = document.getElementById('profile-link');

// VVV --- НАЧАЛО: ЭЛЕМЕНТЫ DOM ДЛЯ ОКНА АНОНСА --- VVV
const announcementOverlay = document.getElementById('announcement-modal-overlay');
const closeAnnouncementBtn = document.getElementById('close-announcement-btn');
const announcementBody = document.getElementById('announcement-body');
const announcementTitle = document.getElementById('announcement-title');
const announcementDescription = document.getElementById('announcement-description');
const announcementDate = document.getElementById('announcement-date');
const waitButton = document.getElementById('wait-button');
let currentAnnouncementId = null; // Переменная для хранения ID текущего анонса
// ^^^ --- КОНЕЦ: ЭЛЕМЕНТЫ DOM ДЛЯ ОКНА АНОНСА --- ^^^


// VVV --- НАЧАЛО: ЛОГИКА ОТОБРАЖЕНИЯ АНОНСА --- VVV
async function handleAnnouncements() {
    const lastShown = localStorage.getItem('announcementLastShown');
    const now = new Date().getTime();
    const oneDay = 24 * 60 * 60 * 1000; // 24 часа в миллисекундах

    if (lastShown && (now - lastShown < oneDay)) {
        console.log('Анонс уже был показан сегодня.');
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('announcements')
            .select('*')
            .order('id', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            if (error.code !== 'PGRST116') {
                 console.error('Ошибка загрузки анонса:', error);
            }
            return;
        }

        if (data) {
            currentAnnouncementId = data.id; // Сохраняем ID анонса

            announcementTitle.textContent = data.title;
            announcementDescription.textContent = data.description;
            // Устанавливаем картинку как фон для элемента
            announcementBody.style.backgroundImage = `url(${data.image_url || 'https://via.placeholder.com/450x600'})`;
            announcementDate.textContent = new Date(data.release_date).toLocaleDateString('ru-RU', {
                day: 'numeric', month: 'long', year: 'numeric'
            });

            // Проверяем, нажимал ли пользователь уже кнопку для этого анонса
            const hasWaited = localStorage.getItem(`announcement_waited_${currentAnnouncementId}`);
            if (hasWaited) {
                waitButton.disabled = true;
                waitButton.textContent = "ВЫ ЖДЕТЕ!";
            } else {
                waitButton.disabled = false;
                waitButton.textContent = "ЖДУ!";
            }

            announcementOverlay.classList.add('is-visible');
            localStorage.setItem('announcementLastShown', now);
        }

    } catch (e) {
        console.error('Не удалось обработать анонс:', e);
    }
}

function closeAnnouncementModal() {
    announcementOverlay.classList.remove('is-visible');
}

async function handleWaitButtonClick() {
    if (!currentAnnouncementId || waitButton.disabled) return;

    waitButton.disabled = true; // Блокируем кнопку сразу

    // Вызываем нашу SQL функцию для увеличения счетчика
    const { error } = await supabaseClient.rpc('increment_wait_count', {
        announcement_id: currentAnnouncementId
    });

    if (error) {
        console.error("Ошибка при увеличении счетчика:", error);
        waitButton.disabled = false; // Разблокируем, если была ошибка
    } else {
        // Запоминаем, что пользователь нажал кнопку для этого анонса
        localStorage.setItem(`announcement_waited_${currentAnnouncementId}`, 'true');
        console.log('Счетчик для анонса', currentAnnouncementId, 'успешно увеличен.');
        // Закрываем окно после успешного нажатия
        setTimeout(closeAnnouncementModal, 300); // Небольшая задержка для наглядности
    }
}


if (announcementOverlay && closeAnnouncementBtn && waitButton) {
    closeAnnouncementBtn.addEventListener('click', closeAnnouncementModal);
    waitButton.addEventListener('click', handleWaitButtonClick);
    announcementOverlay.addEventListener('click', (e) => {
        if (e.target === announcementOverlay) {
            closeAnnouncementModal();
        }
    });
}
// ^^^ --- КОНЕЦ: ЛОГИКА ОТОБРАЖЕНИЯ АНОНСА --- ^^^


// --- ФУНКЦИИ ЗАГРУЗКИ ДАННЫХ ДЛЯ ГЛАВНОЙ СТРАНИЦЫ ---

// Новая функция для загрузки последних релизов (альбомов и синглов)
async function loadRecentReleases() {
    const recentReleasesContainer = document.getElementById('recent-tracks-container');
    recentReleasesContainer.innerHTML = ''; // Очищаем контейнер перед загрузкой

    try {
        // 1. Загружаем последние альбомы
        const { data: albums, error: albumsError } = await supabaseClient
            .from('albums')
            .select('id, title, cover_art_url, artists(name)')
            .order('id', { ascending: false })
            .limit(10);
        if (albumsError) throw albumsError;

        // 2. Загружаем последние синглы (треки без альбома)
        const { data: singles, error: singlesError } = await supabaseClient
            .from('tracks')
            .select('id, title, cover_art_url, artists(name), albums(cover_art_url)') // Запрашиваем cover_art_url из самой таблицы tracks
            .is('album_id', null) // Условие, что это сингл
            .order('id', { ascending: false })
            .limit(10);
        if (singlesError) throw singlesError;

        // --- ДИАГНОСТИЧЕСКАЯ СТРОКА ---
        // Откройте консоль (F12) в браузере, чтобы увидеть, что приходит с сервера.
        // У каждого объекта в массиве должно быть поле cover_art_url.
        // Если оно null или отсутствует, проблема в базе данных (имя колонки, RLS, или данные не добавлены).
        console.log('Полученные данные о синглах из Supabase:', singles);
        // ------------------------------------

        // 3. Преобразуем данные альбомов для отображения
        const mappedAlbums = albums.map(item => ({
            id: item.id,
            title: item.title,
            artistName: item.artists?.name || 'Неизвестный артист',
            coverUrl: getTransformedImageUrl(item.cover_art_url, { width: 500, height: 500, resize: 'cover' }),
            link: `album.html?id=${item.id}`
        }));

        // 4. Преобразуем данные синглов для отображения
        const mappedSingles = singles.map(item => ({
            id: item.id,
            title: item.title,
            artistName: item.artists?.name || 'Неизвестный артист',
            // Используем собственную обложку сингла (item.cover_art_url).
            // Если ее нет, getTransformedImageUrl вернет null, и позже подставится плейсхолдер.
            coverUrl: getTransformedImageUrl(item.cover_art_url, { width: 500, height: 500, resize: 'cover' }),
            link: `track.html?id=${item.id}`
        }));

        // 5. Объединяем, сортируем и обрезаем общий список релизов
        const allReleases = [...mappedAlbums, ...mappedSingles]
            .sort((a, b) => b.id - a.id) // Сортируем по ID, чтобы самые новые были первыми
            .slice(0, 12);
        
        // 6. Отображаем релизы или сообщение, если их нет
        if (allReleases.length === 0) {
            recentReleasesContainer.innerHTML = '<p>Новых релизов пока нет.</p>';
            return;
        }

        allReleases.forEach(release => {
            const cardLink = document.createElement('a');
            cardLink.href = release.link;
            cardLink.classList.add('card-link');
            
            // Если release.coverUrl пустой (null), подставляем плейсхолдер
            const coverSource = release.coverUrl || 'https://via.placeholder.com/250';

            cardLink.innerHTML = `
                <div class="card">
                    <img src="${coverSource}" alt="Обложка">
                    <div class="card-body">
                        <h3>${release.title}</h3>
                        <p>${release.artistName}</p>
                    </div>
                </div>
            `;
            recentReleasesContainer.appendChild(cardLink);
        });

    } catch (error) {
        console.error('Ошибка при загрузке недавних релизов:', error);
        recentReleasesContainer.innerHTML = '<p>Не удалось загрузить релизы. Попробуйте обновить страницу.</p>';
    }
}

// --- АУТЕНТИФИКАЦИЯ И ЗАЩИТА СТРАНИЦЫ ---
async function checkAuthAndLoadContent() {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
        // Если пользователя нет, перенаправляем на страницу входа
        window.location.href = 'login.html';
    } else {
        // Если пользователь авторизован, загружаем контент
        console.log('Пользователь авторизован:', session.user.email);
        if (profileLink) {
             profileLink.style.display = 'inline';
        }
        loadRecentReleases();
        handleAnnouncements(); // <--- ВЫЗЫВАЕМ ФУНКЦИЮ ПРОВЕРКИ АНОНСА
    }
}

// --- ИНИЦИАЛИЗАЦИЯ ---
document.addEventListener('DOMContentLoaded', () => {
    checkAuthAndLoadContent();
});