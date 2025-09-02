// ЭЛЕМЕНТЫ DOM
const loadingIndicator = document.getElementById('loading-indicator');
const albumContent = document.getElementById('album-content');
const albumTitle = document.getElementById('album-title');
const albumArtist = document.getElementById('album-artist');
const albumReleaseDate = document.getElementById('album-release-date');
const albumCover = document.getElementById('album-cover');
const expertRatingEl = document.getElementById('album-expert-rating');
const trackRatingEl = document.getElementById('album-track-rating');
const extraInfoSection = document.getElementById('album-extra-info-section');
const extraInfoP = document.getElementById('album-extra-info');
const trackList = document.getElementById('track-list');
const commentsList = document.getElementById('comments-list');
const rateReleaseButton = document.getElementById('rate-release-button');

// ЭЛЕМЕНТЫ МОДАЛЬНОГО ОКНА
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

// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
let currentUser = null;
let currentAlbumId = null;

// ФУНКЦИИ ЗАГРУЗКИ И ОТОБРАЖЕНИЯ
async function loadAlbumData(albumId) {
    const { data, error } = await supabaseClient
        .from('albums')
        .select(`
            *,
            album_artists ( is_main_artist, artists ( id, name ) ),
            album_ratings ( *, profiles(id, username, avatar_url) ),
            tracks ( id, title, ratings ( score ), track_artists(is_main_artist, artists(name)) )
        `)
        .eq('id', albumId)
        .single();

    if (error || !data) {
        throw new Error('Альбом не найден или произошла ошибка при загрузке.');
    }
    
    document.title = `${data.title} | Cap Checking Ratings`;
    albumTitle.textContent = data.title;
    
    if (data.album_artists && data.album_artists.length > 0) {
        data.album_artists.sort((a, b) => b.is_main_artist - a.is_main_artist);
        const allArtistsHtml = data.album_artists.map(item => 
            `<a href="artist.html?id=${item.artists.id}">${item.artists.name}</a>`
        ).join(', ');
        albumArtist.innerHTML = allArtistsHtml;
    } else {
        albumArtist.textContent = 'Неизвестный артист';
    }

    albumReleaseDate.textContent = data.release_date
        ? `Дата релиза: ${new Date(data.release_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}`
        : 'Дата релиза: неизвестна';

    albumCover.src = getTransformedImageUrl(data.cover_art_url, { width: 500, height: 500, resize: 'cover' }) || 'https://via.placeholder.com/250';
    if (data.extra_info?.trim()) {
        extraInfoP.textContent = data.extra_info;
        extraInfoSection.classList.remove('hidden');
    }
    
    const expertRatings = data.album_ratings || [];
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
        const avg = allTrackRatings.reduce((acc, r) => acc + r.score, 0) / allTrackRatings.length;
        trackRatingEl.textContent = avg.toFixed(2);
        trackRatingEl.style.color = getScoreColor(avg);
    } else {
        trackRatingEl.textContent = '-.--';
        trackRatingEl.style.color = getScoreColor(null);
    }
    
    trackList.innerHTML = '';
    // Сортируем треки по ID для сохранения оригинального порядка
    data.tracks.sort((a, b) => a.id - b.id);
    data.tracks.forEach(track => {
        const trackEl = document.createElement('a');
        trackEl.className = 'track-list-item';
        trackEl.href = `track.html?id=${track.id}`;
        let trackTitleWithFeatures = track.title;
        const artists = track.track_artists || [];
        if (artists.length > 1) {
            const featuredArtists = artists.filter(a => !a.is_main_artist).map(a => a.artists.name);
            if (featuredArtists.length > 0) {
                trackTitleWithFeatures += ` (ft. ${featuredArtists.join(', ')})`;
            }
        }
        let avgScore = track.ratings.length > 0 ? track.ratings.reduce((acc, r) => acc + r.score, 0) / track.ratings.length : null;
        trackEl.innerHTML = `
            <span class="track-title">${trackTitleWithFeatures}</span>
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
    const { data } = await supabaseClient.from('album_ratings').select('*').eq('album_id', currentAlbumId).eq('user_id', currentUser.id).single();
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
    submitAlbumRatingBtn.disabled = true;
    albumRatingStatus.textContent = "Сохранение...";
    albumRatingStatus.style.color = 'var(--text-color-secondary)';

    try {
        const finalScore = parseFloat(finalScoreDisplay.textContent);
        const { error } = await supabaseClient.from('album_ratings').upsert({
            album_id: currentAlbumId,
            user_id: currentUser.id,
            rarity: parseInt(rarityInput.value),
            integrity: parseInt(integrityInput.value),
            depth: parseInt(depthInput.value),
            quality: parseInt(qualityInput.value),
            influence: parseFloat(influenceInput.value),
            final_score: finalScore,
            review_text: reviewInput.value.trim() || null
        }, { onConflict: 'album_id, user_id' });
        
        if (error) throw error;
        
        albumRatingStatus.textContent = "Ваша оценка сохранена!";
        albumRatingStatus.style.color = 'var(--success-color)';

        // --- ИЗМЕНЕНИЕ: ОТПРАВКА УВЕДОМЛЕНИЯ ---
        // Получаем профиль текущего пользователя для уведомления
        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('id, username')
            .eq('id', currentUser.id)
            .single();
        
        if (profile && !profileError) {
            // Запускаем создание уведомления в фоновом режиме, чтобы не задерживать пользователя
            createReviewNotification('album', currentAlbumId, profile, albumTitle.textContent);
        } else if (profileError) {
            console.error("Не удалось получить профиль пользователя для отправки уведомления:", profileError);
        }
        // --- КОНЕЦ ИЗМЕНЕНИЯ ---

        setTimeout(() => {
            modalOverlay.classList.remove('is-visible');
            albumRatingStatus.textContent = '';
            loadAlbumData(currentAlbumId);
        }, 1500);
    } catch (error) {
        console.error("Ошибка сохранения оценки:", error);
        albumRatingStatus.textContent = "Произошла ошибка.";
        albumRatingStatus.style.color = 'var(--error-color)';
    } finally {
        submitAlbumRatingBtn.disabled = false;
    }
}

async function initializePage() {
    try {
        currentAlbumId = new URLSearchParams(window.location.search).get('id');
        if (!currentAlbumId) {
            throw new Error('ID альбома не указан в адресе страницы.');
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
    } catch(error) {
        console.error('Произошла критическая ошибка на странице альбома:', error);
        loadingIndicator.textContent = `Ошибка: ${error.message}`;
        albumContent.classList.add('hidden');
        loadingIndicator.classList.remove('hidden');
    }
}

document.addEventListener('DOMContentLoaded', initializePage);
