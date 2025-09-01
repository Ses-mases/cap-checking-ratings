// ЭЛЕМЕНТЫ DOM
const loadingIndicator = document.getElementById('loading-indicator');
const artistContent = document.getElementById('artist-content');
const artistAvatar = document.getElementById('artist-avatar');
const artistName = document.getElementById('artist-name');
const artistDescription = document.getElementById('artist-description');
const artistTracksList = document.getElementById('artist-tracks-list');
const showAllTracksBtn = document.getElementById('show-all-tracks-btn');
const artistAlbumsContainer = document.getElementById('artist-albums-container');

// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
let currentArtistId = null;

// ФУНКЦИЯ ДЛЯ УПРАВЛЕНИЯ СКРОЛЛОМ АЛЬБОМОВ
function initializeAlbumScroller() {
    const wrapper = document.querySelector('#artist-albums-section .scroll-wrapper');
    const scroller = wrapper.querySelector('.horizontal-scroll-container');
    const prevBtn = wrapper.querySelector('.prev-arrow');
    const nextBtn = wrapper.querySelector('.next-arrow');

    if (!scroller || !prevBtn || !nextBtn) return;
    
    function updateArrowState() {
        const scrollLeft = Math.round(scroller.scrollLeft);
        const scrollWidth = scroller.scrollWidth;
        const clientWidth = scroller.clientWidth;
        
        prevBtn.classList.toggle('hidden', scrollLeft <= 0);
        nextBtn.classList.toggle('hidden', scrollLeft >= scrollWidth - clientWidth - 1);
    }
    
    prevBtn.addEventListener('click', () => {
        scroller.scrollBy({ left: -scroller.clientWidth * 0.8, behavior: 'smooth' });
    });
    nextBtn.addEventListener('click', () => {
        scroller.scrollBy({ left: scroller.clientWidth * 0.8, behavior: 'smooth' });
    });
    
    scroller.addEventListener('scroll', updateArrowState);
    new ResizeObserver(updateArrowState).observe(scroller);
    
    updateArrowState();
}


// ФУНКЦИИ ЗАГРУЗКИ И ОТОБРАЖЕНИЯ
async function loadArtistData(artistId) {
    try {
        const [artistRes, tracksRes, albumsRes] = await Promise.all([
            supabaseClient.from('artists').select('name, avatar_url, description').eq('id', artistId).single(),
            // ИЗМЕНЕНО: Запрос теперь включает артистов для каждого трека
            supabaseClient.from('track_artists').select('tracks(id, title, ratings(score), track_artists(is_main_artist, artists(name)))').eq('artist_id', artistId),
            supabaseClient.from('album_artists').select('albums(id, title, cover_art_url, album_ratings(final_score))').eq('artist_id', artistId)
        ]);

        if (artistRes.error) throw artistRes.error;
        if (tracksRes.error) throw tracksRes.error;
        if (albumsRes.error) throw albumsRes.error;

        const artistData = artistRes.data;
        document.title = `${artistData.name} | Cap Checking Ratings`;
        artistName.textContent = artistData.name;
        artistDescription.textContent = artistData.description || 'Описание отсутствует.';
        artistAvatar.src = getTransformedImageUrl(artistData.avatar_url, { width: 500, height: 500, resize: 'cover' }) || 'https://via.placeholder.com/250';
        
        const rawTracks = tracksRes.data.map(item => item.tracks).filter(Boolean);
        const tracksWithAvgScore = rawTracks.map(track => {
            const avgScore = track.ratings.length > 0
                ? track.ratings.reduce((sum, r) => sum + r.score, 0) / track.ratings.length
                : 0;
            return { ...track, avgScore };
        }).sort((a, b) => b.avgScore - a.avgScore);

        artistTracksList.innerHTML = '';
        if (tracksWithAvgScore.length > 0) {
            // ИЗМЕНЕНО: Добавлена логика форматирования названия
            tracksWithAvgScore.forEach((track, index) => {
                const trackEl = document.createElement('a');
                trackEl.className = 'track-list-item';
                trackEl.href = `track.html?id=${track.id}`;
                if (index >= 5) {
                    trackEl.classList.add('initially-hidden');
                }

                let trackTitleWithFeatures = track.title;
                const artists = track.track_artists || [];
                // Мы на странице ОДНОГО из артистов, поэтому показываем фиты с ДРУГИМИ
                if (artists.length > 1) {
                    const featuredArtists = artists
                        .filter(a => a.artists.id != artistId) // Показываем только других артистов
                        .map(a => a.artists.name);
                    if (featuredArtists.length > 0) {
                        trackTitleWithFeatures += ` (ft. ${featuredArtists.join(', ')})`;
                    }
                }

                trackEl.innerHTML = `
                    <span class="track-title">${trackTitleWithFeatures}</span>
                    <span class="track-avg-score" style="color: ${getScoreColor(track.avgScore)}">
                        ${track.avgScore > 0 ? track.avgScore.toFixed(2) : '-.--'}
                    </span>`;
                artistTracksList.appendChild(trackEl);
            });
            if (tracksWithAvgScore.length > 5) {
                showAllTracksBtn.classList.remove('hidden');
            }
        } else {
            artistTracksList.innerHTML = '<p>Треки этого исполнителя еще не добавлены.</p>';
        }

        const rawAlbums = albumsRes.data.map(item => item.albums).filter(Boolean);
        const albumsWithAvgScore = rawAlbums.map(album => {
             const avgScore = album.album_ratings.length > 0
                ? album.album_ratings.reduce((sum, r) => sum + r.final_score, 0) / album.album_ratings.length
                : 0;
            return { ...album, avgScore };
        }).sort((a, b) => b.avgScore - a.avgScore);

        artistAlbumsContainer.innerHTML = '';
        if (albumsWithAvgScore.length > 0) {
            albumsWithAvgScore.forEach(album => {
                const cardLink = document.createElement('a');
                cardLink.href = `album.html?id=${album.id}`;
                cardLink.className = 'card-link';
                const coverSource = getTransformedImageUrl(album.cover_art_url, { width: 500, height: 500, resize: 'cover' }) || 'https://via.placeholder.com/250';

                cardLink.innerHTML = `
                    <div class="card">
                        <img src="${coverSource}" alt="Обложка" loading="lazy">
                        <div class="card-body">
                            <h3>${album.title}</h3>
                            <p>${artistData.name}</p>
                        </div>
                    </div>`;
                artistAlbumsContainer.appendChild(cardLink);
            });
            initializeAlbumScroller();
        } else {
            artistAlbumsContainer.innerHTML = '<p>Альбомы этого исполнителя еще не добавлены.</p>';
        }

        loadingIndicator.classList.add('hidden');
        artistContent.classList.remove('hidden');

    } catch (error) {
        console.error('Ошибка загрузки данных артиста:', error);
        loadingIndicator.textContent = 'Ошибка: Артист не найден.';
    }
}

// ОБРАБОТЧИКИ СОБЫТИЙ
showAllTracksBtn.addEventListener('click', () => {
    const hiddenTracks = artistTracksList.querySelectorAll('.initially-hidden');
    hiddenTracks.forEach(track => {
        track.classList.remove('initially-hidden');
    });
    showAllTracksBtn.classList.add('hidden');
});

// ИНИЦИАЛИЗАЦИЯ СТРАНИЦЫ
async function initializePage() {
    currentArtistId = new URLSearchParams(window.location.search).get('id');
    if (!currentArtistId) {
        loadingIndicator.textContent = 'Ошибка: ID артиста не указан.';
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