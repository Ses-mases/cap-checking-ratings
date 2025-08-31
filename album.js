// --- ЭЛЕМЕНТЫ DOM ---
const loadingIndicator = document.getElementById('loading-indicator');
const albumContent = document.getElementById('album-content');
const albumTitle = document.getElementById('album-title');
const albumArtist = document.getElementById('album-artist');
const albumCover = document.getElementById('album-cover');
const expertRatingEl = document.getElementById('album-expert-rating');
const trackRatingEl = document.getElementById('album-track-rating');
const extraInfoSection = document.getElementById('album-extra-info-section');
const extraInfoP = document.getElementById('album-extra-info');
const trackList = document.getElementById('track-list');
const commentsList = document.getElementById('comments-list');
const rateReleaseButton = document.getElementById('rate-release-button');

// --- ЭЛЕМЕНТЫ МОДАЛЬНОГО ОКНА ---
const modalOverlay = document.getElementById('album-rating-modal-overlay');
const albumRatingForm = document.getElementById('album-rating-form');
const finalScoreDisplay = document.getElementById('final-score-display');
const albumRatingStatus = document.getElementById('album-rating-status');
const rarityValueSpan = document.getElementById('rarity-value');
const integrityValueSpan = document.getElementById('integrity-value');
const depthValueSpan = document.getElementById('depth-value');
const qualityValueSpan = document.getElementById('quality-value');
const influenceValueSpan = document.getElementById('influence-value');
const rarityInput = document.getElementById('rarity-input');
const integrityInput = document.getElementById('integrity-input');
const depthInput = document.getElementById('depth-input');
const qualityInput = document.getElementById('quality-input');
const influenceInput = document.getElementById('influence-input');
const reviewInput = document.getElementById('review-input');
const submitAlbumRatingBtn = document.getElementById('submit-album-rating');
const cancelAlbumRatingBtn = document.getElementById('cancel-album-rating');

// --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ---
let currentUser = null;
let currentAlbumId = null;

// --- ФУНКЦИИ ЗАГРУЗКИ И ОТОБРАЖЕНИЯ ---
async function loadAlbumData(albumId) {
    const { data, error } = await supabaseClient
        .from('albums')
        .select(`
            *,
            artists ( name ),
            tracks ( id, title, ratings ( score ) ),
            album_ratings ( *, profiles(username, avatar_url) )
        `)
        .eq('id', albumId)
        .single();

    if (error || !data) {
        console.error('Ошибка загрузки альбома:', error);
        loadingIndicator.textContent = 'Ошибка: Альбом не найден.';
        return;
    }
    document.title = `${data.title} | Cap Checking Ratings`;
    albumTitle.textContent = data.title;
    albumArtist.textContent = data.artists.name;
    // ИЗМЕНЕНИЕ: Оптимизируем главную обложку
    albumCover.src = getTransformedImageUrl(data.cover_art_url, { width: 500, height: 500, resize: 'cover' }) || 'https://via.placeholder.com/250';
    if (data.extra_info && data.extra_info.trim() !== '') {
        extraInfoP.textContent = data.extra_info;
        extraInfoSection.classList.remove('hidden');
    }
    const expertRatings = data.album_ratings || [];
    
    // ИЗМЕНЕНИЕ: Добавляем расчет средней экспертной оценки
    if (expertRatings.length > 0) {
        const avgExpertScore = expertRatings.reduce((acc, r) => acc + r.final_score, 0) / expertRatings.length;
        expertRatingEl.textContent = avgExpertScore.toFixed(2);
        expertRatingEl.style.color = getScoreColor(avgExpertScore);
    } else {
        expertRatingEl.textContent = '-.--';
        expertRatingEl.style.color = getScoreColor(null);
    }

    const allTrackRatings = data.tracks.flatMap(track => track.ratings || []);
    if (allTrackRatings.length > 0) {
        const sum = allTrackRatings.reduce((acc, r) => acc + r.score, 0);
        const avg = sum / allTrackRatings.length;
        trackRatingEl.textContent = avg.toFixed(2);
        trackRatingEl.style.color = getScoreColor(avg);
    } else {
        trackRatingEl.textContent = '-.--';
        trackRatingEl.style.color = getScoreColor(null);
    }
    trackList.innerHTML = '';
    data.tracks.forEach(track => {
        const trackEl = document.createElement('a');
        trackEl.className = 'track-list-item';
        trackEl.href = `track.html?id=${track.id}`;
        let avgScore = null;
        if(track.ratings.length > 0) {
            const sum = track.ratings.reduce((acc, r) => acc + r.score, 0);
            avgScore = sum / track.ratings.length;
        }
        trackEl.innerHTML = `
            <span class="track-title">${track.title}</span>
            <span class="track-avg-score" style="color: ${getScoreColor(avgScore)}">
                ${avgScore ? avgScore.toFixed(2) : '-.--'}
            </span>`;
        trackList.appendChild(trackEl);
    });
    commentsList.innerHTML = '';
    if (expertRatings.length > 0) {
        expertRatings.forEach(review => {
            const reviewEl = createCommentElement(review.profiles, review.final_score, review.review_text);
            commentsList.appendChild(reviewEl);
        });
    } else {
        commentsList.innerHTML = '<p>Рецензий на альбом пока нет.</p>';
    }
    loadingIndicator.classList.add('hidden');
    albumContent.classList.remove('hidden');
}

async function loadUserAlbumRating() {
    const { data, error } = await supabaseClient.from('album_ratings')
        .select('*')
        .eq('album_id', currentAlbumId)
        .eq('user_id', currentUser.id)
        .single();
    
    if (data) {
        rarityInput.value = data.rarity;
        integrityInput.value = data.integrity;
        depthInput.value = data.depth;
        qualityInput.value = data.quality;
        influenceInput.value = data.influence;
        reviewInput.value = data.review_text || '';
        
        rarityValueSpan.textContent = data.rarity;
        integrityValueSpan.textContent = data.integrity;
        depthValueSpan.textContent = data.depth;
        qualityValueSpan.textContent = data.quality;
        influenceValueSpan.textContent = data.influence;
        
        calculateFinalScore();
    }
}

// --- ЛОГИКА МОДАЛЬНОГО ОКНА ---
function initializeRatingModal() {
    rateReleaseButton.addEventListener('click', async () => {
        await loadUserAlbumRating();
        modalOverlay.classList.add('is-visible');
    });
    cancelAlbumRatingBtn.addEventListener('click', () => modalOverlay.classList.remove('is-visible'));
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) modalOverlay.classList.remove('is-visible');
    });

    albumRatingForm.addEventListener('input', (e) => {
        if (e.target.id === 'rarity-input') rarityValueSpan.textContent = e.target.value;
        if (e.target.id === 'integrity-input') integrityValueSpan.textContent = e.target.value;
        if (e.target.id === 'depth-input') depthValueSpan.textContent = e.target.value;
        if (e.target.id === 'quality-input') qualityValueSpan.textContent = e.target.value;
        if (e.target.id === 'influence-input') influenceValueSpan.textContent = e.target.value;
        
        calculateFinalScore();
    });

    albumRatingForm.addEventListener('submit', handleRatingSubmit);

    const tooltipIcons = document.querySelectorAll('.tooltip-icon');
    tooltipIcons.forEach(icon => {
        icon.addEventListener('click', (e) => {
            // Предотвращаем всплытие события, чтобы не закрыть модальное окно
            e.stopPropagation(); 
            
            const tooltipText = icon.nextElementSibling;
            
            // Закрываем все другие открытые тултипы
            document.querySelectorAll('.tooltip-text.is-visible').forEach(visibleTooltip => {
                if (visibleTooltip !== tooltipText) {
                    visibleTooltip.classList.remove('is-visible');
                }
            });
            
            // Переключаем видимость текущего тултипа
            tooltipText.classList.toggle('is-visible');
        });
    });

    // Добавим закрытие тултипов при клике в любом месте модального окна
    albumRatingForm.addEventListener('click', () => {
        document.querySelectorAll('.tooltip-text.is-visible').forEach(visibleTooltip => {
            visibleTooltip.classList.remove('is-visible');
        });
    });
}

function calculateFinalScore() {
    const rarity = parseInt(rarityInput.value);
    const integrity = parseInt(integrityInput.value);
    const depth = parseInt(depthInput.value);
    const quality = parseFloat(qualityInput.value);
    const influence = parseFloat(influenceInput.value);
    
    const finalScore = (rarity + integrity + depth) * (quality / 100) * influence;
    finalScoreDisplay.textContent = finalScore.toFixed(2);
    finalScoreDisplay.style.color = getScoreColor(finalScore);
}

async function handleRatingSubmit(e) {
    e.preventDefault();
    
    // ИЗМЕНЕНИЕ: Блокируем кнопку на время отправки
    submitAlbumRatingBtn.disabled = true;
    albumRatingStatus.textContent = "Сохранение...";
    albumRatingStatus.style.color = 'var(--text-color-secondary)';

    try {
        const finalScore = parseFloat(finalScoreDisplay.textContent);
        const upsertData = {
            album_id: currentAlbumId,
            user_id: currentUser.id,
            rarity: parseInt(rarityInput.value),
            integrity: parseInt(integrityInput.value),
            depth: parseInt(depthInput.value),
            quality: parseInt(qualityInput.value),
            influence: parseFloat(influenceInput.value),
            final_score: finalScore,
            review_text: reviewInput.value.trim() || null
        };

        const { error } = await supabaseClient.from('album_ratings').upsert(upsertData, { onConflict: 'album_id, user_id' });

        if (error) {
            throw error;
        }

        albumRatingStatus.textContent = "Ваша оценка сохранена!";
        albumRatingStatus.style.color = 'green';

        // ИЗМЕНЕНИЕ: Чуть дольше показываем сообщение об успехе
        setTimeout(() => {
            modalOverlay.classList.remove('is-visible');
            albumRatingStatus.textContent = '';
            loadAlbumData(currentAlbumId); // Перезагружаем данные для обновления страницы
        }, 2000);

    } catch (error) {
        console.error("Ошибка сохранения оценки:", error);
        albumRatingStatus.textContent = "Произошла ошибка.";
        albumRatingStatus.style.color = 'var(--error-color)';
    } finally {
        // ИЗМЕНЕНИЕ: Разблокируем кнопку в любом случае
        submitAlbumRatingBtn.disabled = false;
    }
}

// --- ИНИЦИАЛИЗАЦИЯ СТРАНИЦЫ ---
async function initializePage() {
    currentAlbumId = new URLSearchParams(window.location.search).get('id');
    if (!currentAlbumId) {
        loadingIndicator.textContent = 'Ошибка: ID альбома не указан.';
        return;
    }

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }
    currentUser = session.user;

    await loadAlbumData(currentAlbumId);
    initializeRatingModal();
    calculateFinalScore(); 
}

document.addEventListener('DOMContentLoaded', initializePage);