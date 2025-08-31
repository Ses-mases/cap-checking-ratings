// --- ЭЛЕМЕНТЫ DOM ГЛАВНОЙ СТРАНИЦЫ ---
const recentTracksContainer = document.getElementById('recent-tracks-container');
const profileLink = document.getElementById('profile-link');

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
                    <h3>${release.title}</h3>
                    <p>${release.artistName}</p>
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
    }
}

// --- ИНИЦИАЛИЗАЦИЯ ---
document.addEventListener('DOMContentLoaded', () => {
    checkAuthAndLoadContent();
});
