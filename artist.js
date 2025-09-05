
// ЭЛЕМЕНТЫ DOM
const loadingIndicator = document.getElementById('loading-indicator');
const artistContent = document.getElementById('artist-content');
const artistAvatar = document.getElementById('artist-avatar');
const artistName = document.getElementById('artist-name');
const artistRatingContainer = document.getElementById('artist-rating-container');
const artistDescription = document.getElementById('artist-description');
const artistTracksList = document.getElementById('artist-tracks-list');
const artistAlbumsContainer = document.getElementById('artist-albums-container');
const tracksPaginationControls = document.getElementById('tracks-pagination-controls');

// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
let currentArtistId = null;
let trackCurrentPage = 0;
const TRACK_PAGE_SIZE = 20;
let isTracksLoading = false;
let loadMoreTracksBtn;

// ФУНКЦИЯ ДЛЯ УПРАВЛЕНИЯ СКРОЛЛОМ АЛЬБОМОВ
function initializeAlbumScroller() {
    const wrapper = document.querySelector('#artist-albums-section .scroll-wrapper');
    if (!wrapper) return;
    const scroller = wrapper.querySelector('.horizontal-scroll-container');
    const prevBtn = wrapper.querySelector('.prev-arrow');
    const nextBtn = wrapper.querySelector('.next-arrow');

    if (!scroller || !prevBtn || !nextBtn) return;

    const updateArrowState = () => {
        const scrollLeft = Math.round(scroller.scrollLeft);
        const scrollWidth = scroller.scrollWidth;
        const clientWidth = scroller.clientWidth;

        prevBtn.classList.toggle('hidden', scrollLeft <= 0);
        nextBtn.classList.toggle('hidden', scrollLeft >= scrollWidth - clientWidth - 1);
    };

    prevBtn.addEventListener('click', () => {
        scroller.scrollBy({ left: -scroller.clientWidth * 0.8, behavior: 'smooth' });
    });
    nextBtn.addEventListener('click', () => {
        scroller.scrollBy({ left: scroller.clientWidth * 0.8, behavior: 'smooth' });
    });

    scroller.addEventListener('scroll', updateArrowState, { passive: true });
    const resizeObserver = new ResizeObserver(updateArrowState);
    resizeObserver.observe(scroller);
    updateArrowState();
}


// ФУНКЦИИ ЗАГРУЗКИ И ОТОБРАЖЕНИЯ
async function loadMoreTracks() {
    if (isTracksLoading || !currentArtistId) return;
    isTracksLoading = true;
    if (loadMoreTracksBtn) loadMoreTracksBtn.disabled = true;

    const from = trackCurrentPage * TRACK_PAGE_SIZE;
    const to = from + TRACK_PAGE_SIZE - 1;

    const { data: trackLinks, error } = await supabaseClient
        .from('track_artists')
        .select('tracks!inner(id, title, ratings(score))')
        .eq('artist_id', currentArtistId)
        .order('id', { referencedTable: 'tracks', ascending: false })
        .range(from, to);

    if (error) {
        console.error('Ошибка загрузки треков:', error);
        if (trackCurrentPage === 0) artistTracksList.innerHTML = '<p>Не удалось загрузить треки.</p>';
        isTracksLoading = false;
        return;
    }

    const tracks = trackLinks ? trackLinks.map(link => link.tracks).filter(Boolean) : [];
    const tracksWithAvgScore = tracks.map(track => {
        const avgScore = track.ratings.length > 0
            ? track.ratings.reduce((sum, r) => sum + r.score, 0) / track.ratings.length
            : 0;
        return { ...track, avgScore };
    }).sort((a, b) => b.avgScore - a.avgScore);

    renderTracks(tracksWithAvgScore, trackCurrentPage === 0);
    trackCurrentPage++;

    tracksPaginationControls.innerHTML = '';
    if (tracks.length === TRACK_PAGE_SIZE) {
        loadMoreTracksBtn = document.createElement('button');
        loadMoreTracksBtn.textContent = 'Загрузить еще';
        loadMoreTracksBtn.className = 'button button-secondary';
        loadMoreTracksBtn.addEventListener('click', loadMoreTracks);
        tracksPaginationControls.appendChild(loadMoreTracksBtn);
    }

    if (trackCurrentPage === 1 && tracks.length === 0) {
        artistTracksList.innerHTML = '<p>Треки этого исполнителя еще не добавлены.</p>';
    }

    isTracksLoading = false;
}

async function loadArtistData(artistId) {
    try {
        const { data: artistData, error: artistError } = await supabaseClient
            .from('artists')
            .select(`
                *,
                album_artists(albums(id, title, cover_art_url))
            `)
            .eq('id', artistId)
            .single();

        if (artistError || !artistData) {
            console.error('Ошибка при загрузке данных артиста:', artistError);
            throw new Error('Артист с таким ID не найден в базе данных.');
        }

        document.title = `${artistData.name} | Cap Checking Ratings`;
        artistName.textContent = artistData.name;
        artistDescription.textContent = artistData.description || 'Описание отсутствует.';
        const finalAvatarUrl = artistData.avatar_url || 'https://texytgcdtafeejqxftqj.supabase.co/storage/v1/object/public/avatars/public/avatar.png';
        artistAvatar.src = getTransformedImageUrl(finalAvatarUrl, { width: 500, height: 500, resize: 'cover' });
        artistAvatar.alt = `Аватар ${artistData.name}`;

        if (artistData.rating !== null && artistData.rating !== undefined) {
            const roundedRating = parseFloat(artistData.rating).toFixed(1);
            const ratingColor = getScoreColor(artistData.rating, 100);
            const ratingDiv = document.createElement('div');
            ratingDiv.className = 'artist-rating';
            ratingDiv.style.setProperty('--rating-color', ratingColor); 
            ratingDiv.innerHTML = `Рейтинг: <strong>${roundedRating}</strong>`;
            artistRatingContainer.innerHTML = '';
            artistRatingContainer.appendChild(ratingDiv);
        }

        const uniqueAlbums = Array.from(new Map(artistData.album_artists.map(item => item.albums).filter(Boolean).map(album => [album.id, album])).values());
        renderAlbums(uniqueAlbums, artistData.name);
        
        loadingIndicator.classList.add('hidden');
        artistContent.classList.remove('hidden');
        
        initializeAlbumScroller();
        await loadMoreTracks();

    } catch (error) {
        console.error('Полная ошибка загрузки страницы артиста:', error);
        loadingIndicator.textContent = 'Ошибка: Не удалось загрузить данные артиста.';
    }
}

function renderTracks(tracks, isInitialLoad) {
    if (isInitialLoad) {
        artistTracksList.innerHTML = '';
    }
    
    if (tracks.length > 0) {
        tracks.forEach(track => {
            const trackEl = document.createElement('a');
            trackEl.className = 'track-list-item';
            trackEl.href = `track.html?id=${track.id}`;

            trackEl.innerHTML = `
                <span class="track-title">${track.title}</span>
                <span class="track-avg-score" style="color: ${getScoreColor(track.avgScore)}">
                    ${track.avgScore > 0 ? track.avgScore.toFixed(2) : '-.--'}
                </span>`;
            artistTracksList.appendChild(trackEl);
        });
    }
}

function renderAlbums(albums, mainArtistName) {
     artistAlbumsContainer.innerHTML = '';
    if (albums.length > 0) {
        albums.forEach(album => {
            const cardLink = document.createElement('a');
            cardLink.href = `album.html?id=${album.id}`;
            cardLink.className = 'card-link';
            const coverSource = getTransformedImageUrl(album.cover_art_url, { width: 500, height: 500, resize: 'cover' }) || 'https://via.placeholder.com/250';

            cardLink.innerHTML = `
                <div class="card">
                    <img src="${coverSource}" alt="Обложка альбома ${album.title}" loading="lazy">
                    <div class="card-body">
                        <h3>${album.title}</h3>
                        <p>${mainArtistName}</p>
                    </div>
                </div>`;
            artistAlbumsContainer.appendChild(cardLink);
        });
    } else {
        artistAlbumsContainer.innerHTML = '<p>Альбомы этого исполнителя еще не добавлены.</p>';
    }
}

// ИНИЦИАЛИЗАЦИЯ СТРАНИЦЫ
async function initializePage() {
    currentArtistId = new URLSearchParams(window.location.search).get('id');
    if (!currentArtistId) {
        loadingIndicator.textContent = 'Ошибка: ID артиста не указан в адресе страницы.';
        return;
    }

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    await loadArtistData(currentArtistId);
}

document.addEventListener('DOMContentLoaded', initializePage);