// ЭЛЕМЕНТЫ DOM
const loadingIndicator = document.getElementById('loading-indicator');
const trackContent = document.getElementById('track-content');
const trackTitle = document.getElementById('track-title');
const trackArtist = document.getElementById('track-artist');
const trackReleaseDate = document.getElementById('track-release-date');
const trackCover = document.getElementById('track-cover');
const averageRatingEl = document.getElementById('track-average-rating');
const albumLinkP = document.getElementById('track-album-link');
const extraInfoSection = document.getElementById('track-extra-info-section');
const extraInfoP = document.getElementById('track-extra-info');
const lyricsSection = document.getElementById('track-lyrics-section');
const trackLyrics = document.getElementById('track-lyrics');
const ratingForm = document.getElementById('rating-form');
const ratingStatus = document.getElementById('rating-status');
const reviewsList = document.getElementById('reviews-list');

// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
let currentUser = null;
let currentTrackId = null;

// ФУНКЦИИ ЗАГРУЗКИ И ОТОБРАЖЕНИЯ
async function loadTrackData(trackId) {
    const { data, error } = await supabaseClient
        .from('tracks')
        .select(`
            *,
            albums ( id, title, cover_art_url, release_date ),
            ratings ( *, profiles ( id, username, avatar_url ) ),
            track_artists ( is_main_artist, artists ( id, name ) )
        `)
        .eq('id', trackId)
        .single();

    if (error || !data) {
        throw new Error('Трек не найден или произошла ошибка при загрузке.');
    }

    if (data.track_artists && data.track_artists.length > 0) {
        data.track_artists.sort((a, b) => b.is_main_artist - a.is_main_artist);
        const featuredArtists = data.track_artists.filter(a => !a.is_main_artist);
        let titleHtml = data.title;
        if (featuredArtists.length > 0) {
            const featuredNames = featuredArtists.map(a => a.artists.name).join(', ');
            titleHtml += ` (ft. ${featuredNames})`;
        }
        document.title = `${titleHtml} | Cap Checking Ratings`;
        trackTitle.innerHTML = titleHtml;

        const allArtistsHtml = data.track_artists.map(item => 
            `<a href="artist.html?id=${item.artists.id}">${item.artists.name}</a>`
        ).join(', ');
        trackArtist.innerHTML = allArtistsHtml;

    } else {
        document.title = `${data.title} | Cap Checking Ratings`;
        trackTitle.textContent = data.title;
        trackArtist.textContent = 'Неизвестный артист';
    }

    const releaseDate = data.release_date || data.albums?.release_date;
    trackReleaseDate.textContent = releaseDate 
        ? `Дата релиза: ${new Date(releaseDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}`
        : 'Дата релиза: неизвестна';

    const finalCoverUrl = data.cover_art_url || data.albums?.cover_art_url;
    trackCover.src = getTransformedImageUrl(finalCoverUrl, { width: 500, height: 500, resize: 'cover' }) || 'https://via.placeholder.com/250';

    if (data.albums) {
        albumLinkP.innerHTML = `Альбом: <a href="album.html?id=${data.albums.id}">${data.albums.title}</a>`;
        albumLinkP.classList.remove('hidden');
    }

    if (data.extra_info?.trim()) {
        extraInfoP.textContent = data.extra_info;
        extraInfoSection.classList.remove('hidden');
    }
    if (data.lyrics?.trim()) {
        trackLyrics.textContent = data.lyrics;
        lyricsSection.classList.remove('hidden');
    }

    const allRatings = data.ratings || [];
    if (allRatings.length > 0) {
        const averageScore = allRatings.reduce((sum, rating) => sum + rating.score, 0) / allRatings.length;
        averageRatingEl.textContent = averageScore.toFixed(2);
        averageRatingEl.style.color = getScoreColor(averageScore);
    } else {
        averageRatingEl.textContent = '-.--';
        averageRatingEl.style.color = getScoreColor(null);
    }

    reviewsList.innerHTML = '';
    if (allRatings.length > 0) {
        allRatings.sort((a, b) => (a.user_id === currentUser.id) ? -1 : (b.user_id === currentUser.id) ? 1 : 0);
        allRatings.forEach(review => {
            const reviewEl = createCommentElement(review.profiles, review.score, review.review_text);
            reviewsList.appendChild(reviewEl);
        });
    } else {
        reviewsList.innerHTML = '<p>Рецензий пока нет. Будьте первым!</p>';
    }

    const userRating = allRatings.find(r => r.user_id === currentUser.id);
    if (userRating) {
        document.getElementById('rating-input').value = userRating.score;
        document.getElementById('review-input').value = userRating.review_text || '';
    }

    loadingIndicator.classList.add('hidden');
    trackContent.classList.remove('hidden');
}

// ОБРАБОТЧИКИ СОБЫТИЙ
ratingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const scoreInput = document.getElementById('rating-input');
    const score = scoreInput.value;
    const submitButton = ratingForm.querySelector('button[type="submit"]');

    if (!score || score < 1 || score > 30) {
        ratingStatus.textContent = "Введите оценку от 1 до 30.";
        ratingStatus.style.color = 'var(--error-color)';
        scoreInput.focus();
        return;
    }
    
    submitButton.disabled = true;
    ratingStatus.textContent = "Сохранение...";
    ratingStatus.style.color = 'var(--text-color-secondary)';

    try {
        const reviewText = document.getElementById('review-input').value.trim();
        const { error } = await supabaseClient.from('ratings').upsert({
            user_id: currentUser.id,
            track_id: currentTrackId,
            score: parseInt(score),
            review_text: reviewText || null
        }, { onConflict: 'user_id, track_id' });

        if (error) throw error;

        ratingStatus.textContent = 'Ваша оценка сохранена!';
        ratingStatus.style.color = 'var(--success-color)';
        
        // --- ВЫЗОВ ПРОВЕРКИ ДОСТИЖЕНИЙ ---
        checkAndNotifyAchievements(currentUser.id);
        
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('id, username')
            .eq('id', currentUser.id)
            .single();
            
        if (profile) {
            createReviewNotification('track', currentTrackId, profile, trackTitle.textContent);
        }

        await loadTrackData(currentTrackId);
    } catch (error) {
        console.error("Ошибка сохранения оценки:", error);
        ratingStatus.textContent = 'Ошибка! Не удалось сохранить.';
        ratingStatus.style.color = 'var(--error-color)';
    } finally {
        submitButton.disabled = false;
    }
});

// ИНИЦИАЛИЗАЦИЯ СТРАНИЦЫ
async function initializePage() {
    try {
        currentTrackId = new URLSearchParams(window.location.search).get('id');
        if (!currentTrackId) {
            loadingIndicator.textContent = 'Ошибка: ID трека не указан в адресе страницы.';
            return;
        }

        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            window.location.href = 'login.html';
            return;
        }
        currentUser = session.user;

        await loadTrackData(currentTrackId);
    } catch (error) {
        console.error('Произошла критическая ошибка на странице трека:', error);
        loadingIndicator.textContent = `Ошибка: ${error.message}`;
        trackContent.classList.add('hidden');
        loadingIndicator.classList.remove('hidden');
    }
}

document.addEventListener('DOMContentLoaded', initializePage);