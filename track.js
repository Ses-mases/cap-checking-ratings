// --- ЭЛЕМЕНТЫ DOM ---
const loadingIndicator = document.getElementById('loading-indicator');
const trackContent = document.getElementById('track-content');
const trackTitle = document.getElementById('track-title');
const trackArtist = document.getElementById('track-artist');
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

// --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ---
let currentUser = null;
let currentTrackId = null;

// ИЗМЕНЕНИЕ: Используем унифицированную структуру для рецензий
function createCommentElement(profile, score, text) {
    const element = document.createElement('div');
    element.className = 'review-item'; // Был comment-item
    const avatarUrl = profile?.avatar_url || 'https://via.placeholder.com/48';
    const username = profile?.username || 'Аноним';
    const scoreFormatted = parseInt(score);
    const reviewText = text || 'Пользователь не оставил рецензию.';

    element.innerHTML = `
        <img src="${avatarUrl}" alt="Аватар" class="review-item-avatar">
        <div class="review-item-body">
            <div class="review-item-header">
                <span class="review-item-author">${username}</span>
                <span class="review-item-score">Оценка: <strong style="color: ${getScoreColor(scoreFormatted)}">${scoreFormatted} / 30</strong></span>
            </div>
            <p class="review-item-text">${reviewText}</p>
        </div>`;
    return element;
}

// --- ФУНКЦИИ ЗАГРУЗКИ И ОТОБРАЖЕНИЯ ---
async function loadTrackData(trackId) {
    const { data, error } = await supabaseClient
        .from('tracks')
        .select(`
            *,
            artists ( name ),
            albums ( id, title, cover_art_url ),
            ratings ( *, profiles ( username, avatar_url ) )
        `)
        .eq('id', trackId)
        .single();

    if (error || !data) {
        console.error('Ошибка загрузки трека:', error);
        loadingIndicator.textContent = 'Ошибка: Трек не найден.';
        return;
    }

    document.title = `${data.title} | Cap Checking Ratings`;
    trackTitle.textContent = data.title;
    trackArtist.textContent = data.artists?.name || 'Неизвестный артист';

    if (data.albums) {
        trackCover.src = data.albums.cover_art_url || 'https://via.placeholder.com/250';
        albumLinkP.innerHTML = `Альбом: <a href="album.html?id=${data.albums.id}">${data.albums.title}</a>`;
        albumLinkP.classList.remove('hidden');
    } else {
        trackCover.src = 'https://via.placeholder.com/250'; 
    }

    if (data.extra_info && data.extra_info.trim() !== '') {
        extraInfoP.textContent = data.extra_info;
        extraInfoSection.classList.remove('hidden');
    }
    if (data.lyrics && data.lyrics.trim() !== '') {
        trackLyrics.textContent = data.lyrics;
        lyricsSection.classList.remove('hidden');
    }

    const allRatings = data.ratings || [];
    if (allRatings.length > 0) {
        allRatings.forEach(review => {
            const reviewEl = createCommentElement(review.profiles, review.score, review.review_text);
            reviewsList.appendChild(reviewEl);
        });
    } else {
        averageRatingEl.textContent = '-.--';
        averageRatingEl.style.color = getScoreColor(null);
    }

    reviewsList.innerHTML = '';
    if (allRatings.length > 0) {
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


// --- ОБРАБОТЧИКИ СОБЫТИЙ ---
ratingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const scoreInput = document.getElementById('rating-input');
    const score = scoreInput.value;
    const submitButton = ratingForm.querySelector('button[type="submit"]');

    if (!score || score < 1 || score > 30) {
        ratingStatus.textContent = "Введите оценку от 1 до 30.";
        scoreInput.focus();
        return;
    }
    
    // ИЗМЕНЕНИЕ: Блокируем кнопку
    submitButton.disabled = true;
    ratingStatus.textContent = "Сохранение...";
    ratingStatus.style.color = 'var(--text-color-secondary)';

    try {
        const reviewText = document.getElementById('review-input').value.trim();
        const upsertData = {
            user_id: currentUser.id,
            track_id: currentTrackId,
            score: parseInt(score),
            review_text: reviewText || null
        };

        const { error } = await supabaseClient.from('ratings').upsert(upsertData, { onConflict: 'user_id, track_id' });

        if (error) {
            throw error;
        }

        ratingStatus.textContent = 'Ваша оценка сохранена!';
        ratingStatus.style.color = 'green';
        await loadTrackData(currentTrackId); // Перезагружаем данные
    } catch (error) {
        console.error("Ошибка сохранения оценки:", error);
        ratingStatus.textContent = 'Ошибка! Не удалось сохранить.';
        ratingStatus.style.color = 'var(--error-color)';
    } finally {
        // ИЗМЕНЕНИЕ: Разблокируем кнопку
        submitButton.disabled = false;
    }
});


// --- ИНИЦИАЛИЗАЦИЯ СТРАНИЦЫ ---
async function initializePage() {
    currentTrackId = new URLSearchParams(window.location.search).get('id');
    if (!currentTrackId) {
        loadingIndicator.textContent = 'Ошибка: ID трека не указан.';
        return;
    }

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }
    currentUser = session.user;

    await loadTrackData(currentTrackId);
}

document.addEventListener('DOMContentLoaded', initializePage);