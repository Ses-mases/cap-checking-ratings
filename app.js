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

// Анимация счетчика
function animateCounter(element, finalCount) {
    if (!element) return;
    let start = 0;
    const duration = 2000; // 2 секунды
    const startTime = performance.now();

    function updateCount(currentTime) {
        const elapsedTime = currentTime - startTime;
        if (elapsedTime >= duration) {
            element.textContent = finalCount.toLocaleString('ru-RU');
            return;
        }
        const progress = elapsedTime / duration;
        const currentCount = Math.floor(finalCount * progress);
        element.textContent = currentCount.toLocaleString('ru-RU');
        requestAnimationFrame(updateCount);
    }

    requestAnimationFrame(updateCount);
}


// Загрузка и отображение статистики
async function loadAndDisplayStats() {
    try {
        const [
            { count: tracksCount, error: e1 },
            { count: albumsCount, error: e2 },
            { count: artistsCount, error: e3 },
            { count: usersCount, error: e4 },
            { count: trackRatingsCount, error: e5 },
            { count: albumRatingsCount, error: e6 }
        ] = await Promise.all([
            supabaseClient.from('tracks').select('*', { count: 'exact', head: true }),
            supabaseClient.from('albums').select('*', { count: 'exact', head: true }),
            supabaseClient.from('artists').select('*', { count: 'exact', head: true }),
            supabaseClient.from('profiles').select('*', { count: 'exact', head: true }),
            supabaseClient.from('ratings').select('*', { count: 'exact', head: true }),
            supabaseClient.from('album_ratings').select('*', { count: 'exact', head: true })
        ]);
        
        // Проверка на ошибки, чтобы избежать "null" в счетчиках
        if (e1 || e2 || e3 || e4 || e5 || e6) {
             throw new Error('Одна или несколько операций подсчета не удались.');
        }

        const totalReviews = (trackRatingsCount || 0) + (albumRatingsCount || 0);

        animateCounter(document.getElementById('stats-tracks-count'), tracksCount || 0);
        animateCounter(document.getElementById('stats-albums-count'), albumsCount || 0);
        animateCounter(document.getElementById('stats-artists-count'), artistsCount || 0);
        animateCounter(document.getElementById('stats-users-count'), usersCount || 0);
        animateCounter(document.getElementById('stats-reviews-count'), totalReviews || 0);

    } catch (error) {
        console.error("Ошибка при загрузке статистики:", error);
        // Можно скрыть блок статистики или показать сообщение об ошибке
        const statsSection = document.getElementById('stats-section');
        if(statsSection) statsSection.style.display = 'none';
    }
}


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
    while (recentTracksContainer.firstChild) {
        recentTracksContainer.removeChild(recentTracksContainer.firstChild);
    }

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
            const p = document.createElement('p');
            p.textContent = 'Новых релизов пока нет.';
            recentTracksContainer.appendChild(p);
            return;
        }

        allReleases.forEach(release => {
            const cardLink = document.createElement('a');
            cardLink.href = release.link;
            cardLink.className = 'card-link';
            
            const card = document.createElement('div');
            card.className = 'card';

            const img = document.createElement('img');
            img.src = release.coverUrl || 'https://via.placeholder.com/250';
            img.alt = `Обложка релиза ${release.title}`;
            img.loading = 'lazy';
            
            const cardBody = document.createElement('div');
            cardBody.className = 'card-body';
            
            const h3 = document.createElement('h3');
            h3.textContent = release.title;
            
            const p = document.createElement('p');
            p.textContent = release.artistName;

            cardBody.appendChild(h3);
            cardBody.appendChild(p);
            card.appendChild(img);
            card.appendChild(cardBody);
            cardLink.appendChild(card);
            recentTracksContainer.appendChild(cardLink);
        });

    } catch (error) {
        console.error('Ошибка при загрузке недавних релизов:', error);
        const p = document.createElement('p');
        p.textContent = 'Не удалось загрузить релизы. Попробуйте обновить страницу.';
        recentTracksContainer.appendChild(p);
    }
}

function renderTopReleases(container, releases, type) {
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    if (!releases || releases.length === 0) {
        const p = document.createElement('p');
        p.textContent = 'Нет данных для отображения.';
        container.appendChild(p);
        return;
    }

    const placeClasses = ['is-first', 'is-second', 'is-third'];

    releases.forEach((release, index) => {
        const cardLink = document.createElement('a');
        cardLink.href = release.link;
        cardLink.className = 'top-card-link';
        if (index < 3) {
            cardLink.classList.add(placeClasses[index]);
        }

        const topCard = document.createElement('div');
        topCard.className = 'top-card';
        
        const cardHeader = document.createElement('div');
        cardHeader.className = 'top-card-header';

        const img = document.createElement('img');
        img.src = release.coverUrl || 'https://via.placeholder.com/90';
        img.alt = `Обложка релиза ${release.title}`;
        img.className = 'top-card-cover';
        img.loading = 'lazy';

        const cardInfo = document.createElement('div');
        cardInfo.className = 'top-card-info';

        const titleH4 = document.createElement('h4');
        titleH4.className = 'top-card-title';
        titleH4.textContent = release.title;

        const artistP = document.createElement('p');
        artistP.className = 'top-card-artist';
        artistP.textContent = release.artistName;
        
        const scoreDiv = document.createElement('div');
        scoreDiv.className = 'top-card-score';
        scoreDiv.style.color = getScoreColor(release.averageScore);
        scoreDiv.textContent = release.averageScore.toFixed(2);
        
        const scoreLabelSpan = document.createElement('span');
        scoreLabelSpan.className = 'score-label';
        scoreLabelSpan.textContent = type === 'album' ? 'Экспертная' : 'Средняя';
        scoreDiv.appendChild(scoreLabelSpan);
        
        cardInfo.appendChild(titleH4);
        cardInfo.appendChild(artistP);
        cardInfo.appendChild(scoreDiv);
        
        cardHeader.appendChild(img);
        cardHeader.appendChild(cardInfo);
        
        const cardBody = document.createElement('div');
        cardBody.className = 'top-card-body';
        
        const reviewP = document.createElement('p');
        if (release.topReview && release.topReview.text) {
            reviewP.className = 'top-card-review';
            reviewP.textContent = `"${release.topReview.text}"`;
            
            const authorSpan = document.createElement('span');
            authorSpan.className = 'top-card-review-author';
            authorSpan.textContent = `– ${release.topReview.author}`;
            reviewP.appendChild(authorSpan);
        } else {
            reviewP.className = 'top-card-review no-review';
            reviewP.textContent = 'Рецензий за этот период нет.';
        }
        cardBody.appendChild(reviewP);

        topCard.appendChild(cardHeader);
        topCard.appendChild(cardBody);
        cardLink.appendChild(topCard);
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
        const p = document.createElement('p');
        p.textContent = 'Не удалось загрузить данные.';
        topTracksContainer.appendChild(p);
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
        const p = document.createElement('p');
        p.textContent = 'Не удалось загрузить данные.';
        topAlbumsContainer.appendChild(p);
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

    loadAndDisplayStats();

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