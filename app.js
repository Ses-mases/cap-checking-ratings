// ЭЛЕМЕНТЫ DOM
const recentTracksContainer = document.getElementById('recent-tracks-container');
const profileLink = document.getElementById('profile-link');

const announcementOverlay = document.getElementById('announcement-modal-overlay');
const announcementModal = document.getElementById('announcement-modal');
const closeAnnouncementBtn = document.getElementById('close-announcement-btn');
const announcementBody = document.getElementById('announcement-body');
const announcementTitle = document.getElementById('announcement-title');
const announcementDescription = document.getElementById('announcement-description');
const announcementDate = document.getElementById('announcement-date');
const waitButton = document.getElementById('wait-button');
let currentAnnouncementId = null;
let cleanupAnnouncementFocus = null;

const topTracksContainer = document.getElementById('top-tracks-container');
const topAlbumsContainer = document.getElementById('top-albums-container');

// ФУНКЦИИ
function initializeScrollers() {
    document.querySelectorAll('.scroll-wrapper').forEach(wrapper => {
        const scroller = wrapper.querySelector('.horizontal-scroll-container');
        const prevBtn = wrapper.querySelector('.prev-arrow');
        const nextBtn = wrapper.querySelector('.next-arrow');

        if (!scroller || !prevBtn || !nextBtn) return;

        const updateArrowState = () => {
            if (!scroller) return;
            const scrollLeft = Math.round(scroller.scrollLeft);
            const scrollWidth = scroller.scrollWidth;
            const clientWidth = scroller.clientWidth;

            prevBtn.classList.toggle('hidden', scrollLeft <= 0);
            nextBtn.classList.toggle('hidden', scrollLeft >= scrollWidth - clientWidth - 1);
        };

        prevBtn.addEventListener('click', () => {
            const scrollAmount = scroller.clientWidth * 0.8;
            scroller.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
        });

        nextBtn.addEventListener('click', () => {
            const scrollAmount = scroller.clientWidth * 0.8;
            scroller.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        });

        scroller.addEventListener('scroll', updateArrowState, { passive: true });
        const resizeObserver = new ResizeObserver(updateArrowState);
        resizeObserver.observe(scroller);

        updateArrowState();
    });
}

async function handleAnnouncements() {
    const lastShown = localStorage.getItem('announcementLastShown');
    const now = new Date().getTime();
    const oneDay = 24 * 60 * 60 * 1000;

    if (lastShown && (now - lastShown < oneDay)) {
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('announcements')
            .select('*')
            .order('id', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error('Ошибка загрузки анонса:', error);
            return;
        }

        if (data && data.image_url) {
            const preloadLink = document.createElement('link');
            preloadLink.rel = 'preload';
            preloadLink.as = 'image';
            preloadLink.href = data.image_url;
            document.head.appendChild(preloadLink);

            currentAnnouncementId = data.id;

            announcementTitle.textContent = data.title;
            announcementDescription.textContent = data.description;
            announcementBody.style.backgroundImage = `url(${data.image_url})`;
            announcementDate.textContent = new Date(data.release_date).toLocaleDateString('ru-RU', {
                day: 'numeric', month: 'long', year: 'numeric'
            });

            const hasWaited = localStorage.getItem(`announcement_waited_${currentAnnouncementId}`);
            if (hasWaited) {
                waitButton.disabled = true;
                waitButton.textContent = "ВЫ ЖДЕТЕ!";
            } else {
                waitButton.disabled = false;
                waitButton.textContent = "ЖДУ!";
            }

            announcementOverlay.classList.add('is-visible');
            if(cleanupAnnouncementFocus) cleanupAnnouncementFocus();
            cleanupAnnouncementFocus = trapFocus(announcementModal);
            localStorage.setItem('announcementLastShown', now.toString());
        }

    } catch (e) {
        console.error('Не удалось обработать анонс:', e);
    }
}

function closeAnnouncementModal() {
    if (announcementOverlay) {
        announcementOverlay.classList.remove('is-visible');
        if(cleanupAnnouncementFocus) cleanupAnnouncementFocus();
    }
}

async function handleWaitButtonClick() {
    if (!currentAnnouncementId || waitButton.disabled) return;

    waitButton.disabled = true;

    const { error } = await supabaseClient.rpc('increment_wait_count', {
        announcement_id: currentAnnouncementId
    });

    if (error) {
        console.error("Ошибка при увеличении счетчика:", error);
        waitButton.disabled = false;
    } else {
        localStorage.setItem(`announcement_waited_${currentAnnouncementId}`, 'true');
        setTimeout(closeAnnouncementModal, 300);
    }
}

async function loadRecentReleases() {
    recentTracksContainer.innerHTML = '';

    try {
        const { data: albums, error: albumsError } = await supabaseClient
            .from('albums')
            .select('id, title, cover_art_url, release_date, album_artists(artists(name))')
            .order('release_date', { ascending: false, nullsLast: true })
            .limit(10);
        if (albumsError) throw albumsError;

        const { data: singles, error: singlesError } = await supabaseClient
            .from('tracks')
            .select('id, title, cover_art_url, albums(cover_art_url), release_date, track_artists(artists(name))')
            .is('album_id', null)
            .order('release_date', { ascending: false, nullsLast: true })
            .limit(10);
        if (singlesError) throw singlesError;

        const mapArtists = (artistsRelation) => {
            if (!artistsRelation || artistsRelation.length === 0) return 'Неизвестный артист';
            return artistsRelation.map(a => a.artists.name).join(', ');
        };

        const mappedAlbums = albums.map(item => ({
            id: item.id,
            title: item.title,
            artistName: mapArtists(item.album_artists),
            coverUrl: getTransformedImageUrl(item.cover_art_url, { width: 500, height: 500, resize: 'cover' }),
            link: `album.html?id=${item.id}`,
            releaseDate: item.release_date
        }));

        const mappedSingles = singles.map(item => ({
            id: item.id,
            title: item.title,
            artistName: mapArtists(item.track_artists),
            coverUrl: getTransformedImageUrl(item.cover_art_url || item.albums?.cover_art_url, { width: 500, height: 500, resize: 'cover' }),
            link: `track.html?id=${item.id}`,
            releaseDate: item.release_date
        }));

        const allReleases = [...mappedAlbums, ...mappedSingles]
            .sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate))
            .slice(0, 12);

        if (allReleases.length === 0) {
            recentTracksContainer.innerHTML = '<p>Новых релизов пока нет.</p>';
            return;
        }

        allReleases.forEach(release => {
            const cardLink = document.createElement('a');
            cardLink.href = release.link;
            cardLink.classList.add('card-link');
            const coverSource = release.coverUrl || 'https://via.placeholder.com/250';

            cardLink.innerHTML = `
                <div class="card">
                    <img src="${coverSource}" alt="Обложка релиза ${release.title}" loading="lazy">
                    <div class="card-body">
                        <h3>${release.title}</h3>
                        <p>${release.artistName}</p>
                    </div>
                </div>
            `;
            recentTracksContainer.appendChild(cardLink);
        });

    } catch (error) {
        console.error('Ошибка при загрузке недавних релизов:', error);
        recentTracksContainer.innerHTML = '<p>Не удалось загрузить релизы. Попробуйте обновить страницу.</p>';
    }
}

function renderTopReleases(container, releases, type) {
    container.innerHTML = '';
    if (!releases || releases.length === 0) {
        container.innerHTML = `<p>Нет данных для отображения.</p>`;
        return;
    }

    const placeClasses = ['is-first', 'is-second', 'is-third'];

    releases.forEach((release, index) => {
        const cardLink = document.createElement('a');
        cardLink.href = release.link;
        cardLink.classList.add('top-card-link');
        if (index < 3) {
            cardLink.classList.add(placeClasses[index]);
        }

        const coverSource = release.coverUrl || 'https://via.placeholder.com/90';
        const scoreLabel = type === 'album' ? 'Экспертная' : 'Средняя';
        const scoreFormatted = release.averageScore.toFixed(2);

        const reviewHtml = (release.topReview && release.topReview.text)
            ? `<p class="top-card-review">
                   "${release.topReview.text}"
                   <span class="top-card-review-author">– ${release.topReview.author}</span>
               </p>`
            : `<p class="top-card-review no-review">Рецензий за этот период нет.</p>`;

        cardLink.innerHTML = `
            <div class="top-card">
                <div class="top-card-header">
                    <img src="${coverSource}" alt="Обложка релиза ${release.title}" class="top-card-cover" loading="lazy">
                    <div class="top-card-info">
                        <h4 class="top-card-title">${release.title}</h4>
                        <p class="top-card-artist">${release.artistName}</p>
                        <div class="top-card-score" style="color: ${getScoreColor(release.averageScore)}">
                           ${scoreFormatted}
                           <span class="score-label">${scoreLabel}</span>
                        </div>
                    </div>
                </div>
                <div class="top-card-body">
                    ${reviewHtml}
                </div>
            </div>
        `;
        container.appendChild(cardLink);
    });
}


async function loadTopTracks() {
    try {
        const { data, error } = await supabaseClient.rpc('get_top_tracks_of_the_month');

        if (error) throw error;
        
        const finalData = data.map(track => {
            const artists = track.artists || [];
            const mainArtists = artists.filter(a => a.is_main).map(a => a.name);
            const featuredArtists = artists.filter(a => !a.is_main).map(a => a.name);

            let trackTitleWithFeatures = track.title;
            if (featuredArtists.length > 0) {
                trackTitleWithFeatures += ` (ft. ${featuredArtists.join(', ')})`;
            }

            return {
                id: track.id,
                title: trackTitleWithFeatures,
                artistName: mainArtists.join(', ') || 'Неизвестный артист',
                coverUrl: getTransformedImageUrl(track.cover_art_url, { width: 180, height: 180, resize: 'cover' }),
                link: `track.html?id=${track.id}`,
                averageScore: track.average_score,
                topReview: track.top_review ? { text: track.top_review.text, author: track.top_review.author } : null
            };
        });

        renderTopReleases(topTracksContainer, finalData, 'track');

    } catch (error) {
        console.error('Ошибка при загрузке лучших треков:', error);
        topTracksContainer.innerHTML = '<p>Не удалось загрузить данные.</p>';
    }
}

async function loadTopAlbums() {
    try {
        const { data, error } = await supabaseClient.rpc('get_top_albums_of_the_month');

        if (error) throw error;

        const finalData = data.map(album => {
            const artistNames = (album.artists || []).map(a => a.name).join(', ');

            return {
                id: album.id,
                title: album.title,
                artistName: artistNames || 'Неизвестный артист',
                coverUrl: getTransformedImageUrl(album.cover_art_url, { width: 180, height: 180, resize: 'cover' }),
                link: `album.html?id=${album.id}`,
                averageScore: album.average_score,
                topReview: album.top_review ? { text: album.top_review.text, author: album.top_review.author } : null
            };
        });

        renderTopReleases(topAlbumsContainer, finalData, 'album');

    } catch (error) {
        console.error('Ошибка при загрузке лучших альбомов:', error);
        topAlbumsContainer.innerHTML = '<p>Не удалось загрузить данные.</p>';
    }
}

async function checkAuthAndLoadContent() {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    if (profileLink) {
        profileLink.style.display = 'inline';
    }

    const results = await Promise.allSettled([
        loadRecentReleases(),
        loadTopTracks(),
        loadTopAlbums()
    ]);

    results.forEach((result, index) => {
        if (result.status === 'rejected') {
            const failedFunctionName = ['loadRecentReleases', 'loadTopTracks', 'loadTopAlbums'][index];
            console.error(`Ошибка при выполнении ${failedFunctionName}:`, result.reason);
        }
    });

    handleAnnouncements();
    initializeScrollers();
}

// ИНИЦИАЛИЗАЦИЯ
document.addEventListener('DOMContentLoaded', () => {
    checkAuthAndLoadContent();
    if (announcementOverlay && closeAnnouncementBtn && waitButton) {
        closeAnnouncementBtn.addEventListener('click', closeAnnouncementModal);
        waitButton.addEventListener('click', handleWaitButtonClick);
        announcementOverlay.addEventListener('click', (e) => {
            if (e.target === announcementOverlay) {
                closeAnnouncementModal();
            }
        });
    }
});