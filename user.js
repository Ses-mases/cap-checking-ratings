// ЭЛЕМЕНТЫ DOM
const loadingIndicator = document.getElementById('loading-indicator');
const profileContent = document.getElementById('profile-content');
const profileUsername = document.getElementById('profile-username');
const profileAvatar = document.getElementById('profile-avatar');
const trackRatingsList = document.getElementById('track-ratings-list');
const albumRatingsList = document.getElementById('album-ratings-list');

// ЗАГРУЗКА И ОТОБРАЖЕНИЕ ДАННЫХ
async function loadUserData(userId) {
    const [profileRes, trackRatingsRes, albumRatingsRes] = await Promise.all([
        supabaseClient.from('profiles').select('username, avatar_url').eq('id', userId).single(),
        supabaseClient.from('ratings').select(`id, score, review_text, tracks(id, title, cover_art_url, albums(cover_art_url))`).eq('user_id', userId).order('id', { ascending: false }),
        supabaseClient.from('album_ratings').select(`id, final_score, review_text, albums(id, title, cover_art_url)`).eq('user_id', userId).order('id', { ascending: false })
    ]);

    if (profileRes.error) throw new Error('Профиль не найден.');
    if (trackRatingsRes.error) throw trackRatingsRes.error;
    if (albumRatingsRes.error) throw albumRatingsRes.error;

    const profileData = profileRes.data;
    const trackRatingsData = trackRatingsRes.data;
    const albumRatingsData = albumRatingsRes.data;

    document.title = `${profileData.username || 'Пользователь'} | Cap Checking Ratings`;
    profileUsername.textContent = profileData.username || 'Имя не указано';
    profileAvatar.src = getTransformedImageUrl(profileData.avatar_url, { width: 240, height: 240, resize: 'cover' }) || 'https://via.placeholder.com/150';

    renderTrackRatings(trackRatingsData);
    renderAlbumRatings(albumRatingsData);

    loadingIndicator.classList.add('hidden');
    profileContent.classList.remove('hidden');
}

function renderTrackRatings(ratings) {
    trackRatingsList.innerHTML = '';
    if (ratings?.length > 0) {
        ratings.forEach(rating => {
            if (!rating.tracks) return;
            const item = document.createElement('div');
            item.className = 'review-item';
            const reviewHtml = rating.review_text ? `<p class="review-item-text">"${rating.review_text}"</p>` : '';
            const finalCoverUrl = rating.tracks.cover_art_url || rating.tracks.albums?.cover_art_url;
            const coverUrl = getTransformedImageUrl(finalCoverUrl, { width: 120, height: 120, resize: 'cover' }) || 'https://via.placeholder.com/60';

            item.innerHTML = `
                <img src="${coverUrl}" alt="Обложка" class="review-item-cover" loading="lazy">
                <div class="review-item-body">
                    <div class="review-item-header">
                        <a href="track.html?id=${rating.tracks.id}" class="review-item-title">${rating.tracks.title}</a>
                        <span class="review-item-score">Оценка: <strong style="color: ${getScoreColor(rating.score)}">${rating.score}/30</strong></span>
                    </div>
                    ${reviewHtml}
                </div>`;
            trackRatingsList.appendChild(item);
        });
    } else {
        trackRatingsList.innerHTML = '<p>Пользователь еще не ставил оценок трекам.</p>';
    }
}

function renderAlbumRatings(ratings) {
    albumRatingsList.innerHTML = '';
    if (ratings?.length > 0) {
        ratings.forEach(rating => {
            if (!rating.albums) return;
            const item = document.createElement('div');
            item.className = 'review-item';
            const reviewHtml = rating.review_text ? `<p class="review-item-text">"${rating.review_text}"</p>` : '';
            const coverUrl = getTransformedImageUrl(rating.albums.cover_art_url, { width: 120, height: 120, resize: 'cover' }) || 'https://via.placeholder.com/60';
            
            item.innerHTML = `
                <img src="${coverUrl}" alt="Обложка" class="review-item-cover" loading="lazy">
                <div class="review-item-body">
                     <div class="review-item-header">
                        <a href="album.html?id=${rating.albums.id}" class="review-item-title">${rating.albums.title}</a>
                        <span class="review-item-score">Оценка: <strong style="color: ${getScoreColor(rating.final_score)}">${parseFloat(rating.final_score).toFixed(2)}/30</strong></span>
                    </div>
                    ${reviewHtml}
                </div>`;
            albumRatingsList.appendChild(item);
        });
    } else {
        albumRatingsList.innerHTML = '<p>Пользователь еще не ставил оценок альбомам.</p>';
    }
}

// ИНИЦИАЛИЗАЦИЯ СТРАНИЦЫ
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const userId = new URLSearchParams(window.location.search).get('id');
        if (!userId) {
            throw new Error('ID пользователя не указан в адресе страницы.');
        }

        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            const profileLink = document.getElementById('profile-link');
            if(profileLink) profileLink.style.display = 'none';
        }

        await loadUserData(userId);
    } catch (error) {
        console.error('Ошибка на странице профиля:', error);
        loadingIndicator.textContent = `Ошибка: ${error.message}`;
        profileContent.classList.add('hidden');
        loadingIndicator.classList.remove('hidden');
    }
});