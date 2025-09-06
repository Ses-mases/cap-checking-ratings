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

    document.title = `Профиль: ${profileData.username || 'Пользователь'} | Cap Checking Ratings`;
    profileUsername.textContent = profileData.username || 'Имя не указано';
    const finalAvatarUrl = profileData.avatar_url || 'https://texytgcdtafeejqxftqj.supabase.co/storage/v1/object/public/avatars/public/avatar.png';
    profileAvatar.src = getTransformedImageUrl(finalAvatarUrl, { width: 240, height: 240, resize: 'cover' });

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

            const finalCoverUrl = rating.tracks.cover_art_url || rating.tracks.albums?.cover_art_url;
            const coverUrl = getTransformedImageUrl(finalCoverUrl, { width: 120, height: 120, resize: 'cover' }) || 'https://via.placeholder.com/60';
            const img = document.createElement('img');
            img.src = coverUrl;
            img.alt = 'Обложка';
            img.className = 'review-item-cover';
            img.loading = 'lazy';

            const bodyDiv = document.createElement('div');
            bodyDiv.className = 'review-item-body';

            const headerDiv = document.createElement('div');
            headerDiv.className = 'review-item-header';
            
            const titleLink = document.createElement('a');
            titleLink.href = `track.html?id=${rating.tracks.id}`;
            titleLink.className = 'review-item-title';
            titleLink.textContent = rating.tracks.title;

            const scoreSpan = document.createElement('span');
            scoreSpan.className = 'review-item-score';
            scoreSpan.textContent = 'Оценка: ';

            const scoreStrong = document.createElement('strong');
            scoreStrong.style.color = getScoreColor(rating.score);
            scoreStrong.textContent = `${rating.score}/30`;
            scoreSpan.appendChild(scoreStrong);

            headerDiv.appendChild(titleLink);
            headerDiv.appendChild(scoreSpan);
            bodyDiv.appendChild(headerDiv);

            if (rating.review_text) {
                const reviewP = document.createElement('p');
                reviewP.className = 'review-item-text';
                reviewP.textContent = `"${rating.review_text}"`;
                bodyDiv.appendChild(reviewP);
            }
            
            item.appendChild(img);
            item.appendChild(bodyDiv);
            trackRatingsList.appendChild(item);
        });
    } else {
        const p = document.createElement('p');
        p.textContent = 'Пользователь еще не ставил оценок трекам.';
        trackRatingsList.appendChild(p);
    }
}

function renderAlbumRatings(ratings) {
    albumRatingsList.innerHTML = '';
    if (ratings?.length > 0) {
        ratings.forEach(rating => {
            if (!rating.albums) return;
            const item = document.createElement('div');
            item.className = 'review-item';
            
            const coverUrl = getTransformedImageUrl(rating.albums.cover_art_url, { width: 120, height: 120, resize: 'cover' }) || 'https://via.placeholder.com/60';
            const img = document.createElement('img');
            img.src = coverUrl;
            img.alt = 'Обложка';
            img.className = 'review-item-cover';
            img.loading = 'lazy';
            
            const bodyDiv = document.createElement('div');
            bodyDiv.className = 'review-item-body';

            const headerDiv = document.createElement('div');
            headerDiv.className = 'review-item-header';

            const titleLink = document.createElement('a');
            titleLink.href = `album.html?id=${rating.albums.id}`;
            titleLink.className = 'review-item-title';
            titleLink.textContent = rating.albums.title;

            const scoreSpan = document.createElement('span');
            scoreSpan.className = 'review-item-score';
            scoreSpan.textContent = 'Оценка: ';

            const scoreStrong = document.createElement('strong');
            scoreStrong.style.color = getScoreColor(rating.final_score);
            scoreStrong.textContent = `${parseFloat(rating.final_score).toFixed(2)}/30`;
            scoreSpan.appendChild(scoreStrong);

            headerDiv.appendChild(titleLink);
            headerDiv.appendChild(scoreSpan);
            bodyDiv.appendChild(headerDiv);

            if (rating.review_text) {
                const reviewP = document.createElement('p');
                reviewP.className = 'review-item-text';
                reviewP.textContent = `"${rating.review_text}"`;
                bodyDiv.appendChild(reviewP);
            }

            item.appendChild(img);
            item.appendChild(bodyDiv);
            albumRatingsList.appendChild(item);
        });
    } else {
        const p = document.createElement('p');
        p.textContent = 'Пользователь еще не ставил оценок альбомам.';
        albumRatingsList.appendChild(p);
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