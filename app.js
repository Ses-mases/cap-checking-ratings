// --- ЭЛЕМЕНТЫ DOM ГЛАВНОЙ СТРАНИЦЫ ---
const recentTracksContainer = document.getElementById('recent-tracks-container');
const profileLink = document.getElementById('profile-link');

// --- ФУНКЦИИ ЗАГРУЗКИ ДАННЫХ ДЛЯ ГЛАВНОЙ СТРАНИЦЫ ---

// Новая функция для загрузки последних релизов (альбомов и синглов)
async function loadRecentReleases() {
    const recentReleasesContainer = document.getElementById('recent-tracks-container');
    recentReleasesContainer.innerHTML = '';

    try {
        const { data: albums, error: albumsError } = await supabaseClient
            .from('albums')
            .select('id, title, cover_art_url, artists(name)')
            .order('id', { ascending: false })
            .limit(10); // Можно увеличить лимит для прокрутки
        if (albumsError) throw albumsError;

        const { data: singles, error: singlesError } = await supabaseClient
            .from('tracks')
            .select('id, title, artists(name), albums(cover_art_url)') 
            .is('album_id', null)
            .order('id', { ascending: false })
            .limit(10); // Можно увеличить лимит для прокрутки
        if (singlesError) throw singlesError;

        const mappedAlbums = albums.map(item => ({
            id: item.id,
            title: item.title,
            artistName: item.artists?.name || 'Неизвестный артист',
            // ИЗМЕНЕНИЕ: Оптимизируем обложку
            coverUrl: getTransformedImageUrl(item.cover_art_url, { width: 500, height: 500, resize: 'cover' }),
            link: `album.html?id=${item.id}`
        }));

        const mappedSingles = singles.map(item => ({
            id: item.id,
            title: item.title,
            artistName: item.artists?.name || 'Неизвестный артист',
            // ИЗМЕНЕНИЕ: Оптимизируем обложку
            coverUrl: getTransformedImageUrl(item.albums?.cover_art_url, { width: 500, height: 500, resize: 'cover' }), 
            link: `track.html?id=${item.id}`
        }));

        const allReleases = [...mappedAlbums, ...mappedSingles]
            .sort((a, b) => b.id - a.id)
            .slice(0, 12); // Отображаем больше элементов для прокрутки
        
        if (allReleases.length === 0) {
            recentReleasesContainer.innerHTML = '<p>Новых релизов пока нет.</p>';
            return;
        }

        allReleases.forEach(release => {
            const cardLink = document.createElement('a');
            cardLink.href = release.link;
            cardLink.classList.add('card-link');
            cardLink.innerHTML = `
                <div class="card">
                    <img src="${release.coverUrl || 'https://via.placeholder.com/250'}" alt="Обложка">
                    <h3>${release.title}</h3>
                    <p>${release.artistName}</p>
                </div>
            `;
            recentReleasesContainer.appendChild(cardLink);
        });

    } catch (error) {
        console.error('Ошибка при загрузке недавних релизов:', error);
        recentReleasesContainer.innerHTML = '<p>Не удалось загрузить релизы.</p>';
    }
}

// --- АУТЕНТИФИКАЦИЯ И ЗАЩИТА СТРАНИЦЫ ---
async function checkAuthAndLoadContent() {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
        window.location.href = 'login.html';
    } else {
        console.log('Пользователь авторизован:', session.user.email);
        if (profileLink) {
             profileLink.style.display = 'inline';
        }
        loadRecentReleases();
        // loadAnnouncements(); // Удалено
    }
}

// --- ИНИЦИАЛИЗАЦИЯ ---
document.addEventListener('DOMContentLoaded', () => {
    checkAuthAndLoadContent();
});