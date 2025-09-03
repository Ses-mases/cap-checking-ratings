// ЭЛЕМЕНТЫ DOM
const recentTracksContainer = document.getElementById('recent-tracks-container');
const profileLink = document.getElementById('profile-link');

const announcementOverlay = document.getElementById('announcement-modal-overlay');
const closeAnnouncementBtn = document.getElementById('close-announcement-btn');
const announcementBody = document.getElementById('announcement-body');
const announcementTitle = document.getElementById('announcement-title');
const announcementDescription = document.getElementById('announcement-description');
const announcementDate = document.getElementById('announcement-date');
const waitButton = document.getElementById('wait-button');
let currentAnnouncementId = null; 

const topTracksContainer = document.getElementById('top-tracks-container');
const topAlbumsContainer = document.getElementById('top-albums-container');

// ... (функции initializeScrollers, handleAnnouncements, closeAnnouncementModal, handleWaitButtonClick остаются без изменений) ...
function initializeScrollers() {
    document.querySelectorAll('.scroll-wrapper').forEach(wrapper => {
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
            const scrollAmount = scroller.clientWidth * 0.8;
            scroller.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
        });

        nextBtn.addEventListener('click', () => {
            const scrollAmount = scroller.clientWidth * 0.8;
            scroller.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        });

        scroller.addEventListener('scroll', updateArrowState);
        new ResizeObserver(updateArrowState).observe(scroller);

        updateArrowState();
    });
}

async function handleAnnouncements() {
    const lastShown = localStorage.getItem('announcementLastShown');
    const now = new Date().getTime();
    const oneDay = 24 * 60 * 60 * 1000;

    if (lastShown && (now - lastShown < oneDay)) {
        console.log('Анонс уже был показан сегодня.');
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('announcements')
            .select('*')
            .order('id', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            if (error.code !== 'PGRST116') {
                 console.error('Ошибка загрузки анонса:', error);
            }
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
            localStorage.setItem('announcementLastShown', now);
        }

    } catch (e) {
        console.error('Не удалось обработать анонс:', e);
    }
}

function closeAnnouncementModal() {
    announcementOverlay.classList.remove('is-visible');
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
        console.log('Счетчик для анонса', currentAnnouncementId, 'успешно увеличен.');
        setTimeout(closeAnnouncementModal, 300);
    }
}

if (announcementOverlay && closeAnnouncementBtn && waitButton) {
    closeAnnouncementBtn.addEventListener('click', closeAnnouncementModal);
    waitButton.addEventListener('click', handleWaitButtonClick);
    announcementOverlay.addEventListener('click', (e) => {
        if (e.target === announcementOverlay) {
            closeAnnouncementModal();
        }
    });
}

async function loadRecentReleases() {
    const recentReleasesContainer = document.getElementById('recent-tracks-container');
    recentReleasesContainer.innerHTML = '';

    try {
        // ИЗМЕНЕНО: Запрос артистов для альбомов
        const { data: albums, error: albumsError } = await supabaseClient
            .from('albums')
            .select('id, title, cover_art_url, release_date, album_artists(artists(name))')
            .order('release_date', { ascending: false, nullsLast: true })
            .limit(10);
        if (albumsError) throw albumsError;

        // ИЗМЕНЕНО: Запрос артистов для синглов
        const { data: singles, error: singlesError } = await supabaseClient
            .from('tracks')
            .select('id, title, cover_art_url, albums(cover_art_url), release_date, track_artists(artists(name))')
            .is('album_id', null)
            .order('release_date', { ascending: false, nullsLast: true })
            .limit(10);
        if (singlesError) throw singlesError;

        // ИЗМЕНЕНО: Сборка имен артистов
        const mappedAlbums = albums.map(item => ({
            id: item.id,
            title: item.title,
            artistName: item.album_artists.map(a => a.artists.name).join(', ') || 'Неизвестный артист',
            coverUrl: getTransformedImageUrl(item.cover_art_url, { width: 500, height: 500, resize: 'cover' }),
            link: `album.html?id=${item.id}`,
            releaseDate: item.release_date
        }));
        
        // ИЗМЕНЕНО: Сборка имен артистов
        const mappedSingles = singles.map(item => ({
            id: item.id,
            title: item.title,
            artistName: item.track_artists.map(a => a.artists.name).join(', ') || 'Неизвестный артист',
            coverUrl: getTransformedImageUrl(item.cover_art_url, { width: 500, height: 500, resize: 'cover' }),
            link: `track.html?id=${item.id}`,
            releaseDate: item.release_date
        }));

        const allReleases = [...mappedAlbums, ...mappedSingles]
            .sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate))
            .slice(0, 12);
        
        if (allReleases.length === 0) {
            recentReleasesContainer.innerHTML = '<p>Новых релизов пока нет.</p>';
            return;
        }

        allReleases.forEach(release => {
            const cardLink = document.createElement('a');
            cardLink.href = release.link;
            cardLink.classList.add('card-link');
            
            const coverSource = release.coverUrl || 'https://via.placeholder.com/250';

            cardLink.innerHTML = `
                <div class="card">
                    <img src="${coverSource}" alt="Обложка" loading="lazy">
                    <div class="card-body">
                        <h3>${release.title}</h3>
                        <p>${release.artistName}</p>
                    </div>
                </div>
            `;
            recentReleasesContainer.appendChild(cardLink);
        });

    } catch (error) {
        console.error('Ошибка при загрузке недавних релизов:', error);
        recentReleasesContainer.innerHTML = '<p>Не удалось загрузить релизы. Попробуйте обновить страницу.</p>';
    }
}

function renderTopReleases(container, releases, type) {
    container.innerHTML = '';
    if (releases.length === 0) {
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
        
        let reviewHtml;
        if (release.topReview && release.topReview.text) {
             reviewHtml = `
                <p class="top-card-review">
                    "${release.topReview.text}"
                    <span class="top-card-review-author">– ${release.topReview.author}</span>
                </p>`;
        } else {
            reviewHtml = `<p class="top-card-review no-review">Рецензий за этот период нет.</p>`;
        }

        cardLink.innerHTML = `
            <div class="top-card">
                <div class="top-card-header">
                    <img src="${coverSource}" alt="Обложка" class="top-card-cover" loading="lazy">
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
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: recentRatings, error: ratingsError } = await supabaseClient
            .from('ratings')
            .select('track_id, score, review_text, profiles(username)')
            .gt('created_at', thirtyDaysAgo.toISOString());
            
        if (ratingsError) throw ratingsError;

        const trackStats = recentRatings.reduce((acc, rating) => {
            const id = rating.track_id;
            if (!acc[id]) {
                acc[id] = {
                    scores: [],
                    topReview: { score: -1, text: null, author: null }
                };
            }
            acc[id].scores.push(rating.score);
            if (rating.score > acc[id].topReview.score) {
                acc[id].topReview = { 
                    score: rating.score, 
                    text: rating.review_text,
                    author: rating.profiles?.username || 'Аноним'
                };
            }
            return acc;
        }, {});

        const trackScores = Object.keys(trackStats).map(id => {
            const stats = trackStats[id];
            const avgScore = stats.scores.reduce((sum, s) => sum + s, 0) / stats.scores.length;
            return {
                id: parseInt(id),
                averageScore: avgScore,
                topReview: stats.topReview
            };
        });

        const top5TracksInfo = trackScores
            .sort((a, b) => b.averageScore - a.averageScore)
            .slice(0, 5);

        if (top5TracksInfo.length === 0) {
            renderTopReleases(topTracksContainer, [], 'track');
            return;
        }

        const top5TrackIds = top5TracksInfo.map(t => t.id);
        // ИЗМЕНЕНО: Запрос теперь включает артистов
        const { data: tracks, error: tracksError } = await supabaseClient
            .from('tracks')
            .select('id, title, cover_art_url, albums(cover_art_url), track_artists(is_main_artist, artists(name))')
            .in('id', top5TrackIds);

        if (tracksError) throw tracksError;
        
        // ИЗМЕНЕНО: Добавлена логика форматирования
        const finalData = top5TracksInfo.map(info => {
            const trackData = tracks.find(t => t.id === info.id);

            // ---- ИСПРАВЛЕНИЕ НАЧИНАЕТСЯ ЗДЕСЬ ----

            // 1. Проверяем, нашлись ли данные для трека. Если нет - пропускаем.
            if (!trackData) {
                return null;
            }

            const finalCoverUrl = trackData.cover_art_url || trackData.albums?.cover_art_url;
            let trackTitleWithFeatures = trackData.title;
            const artists = trackData.track_artists || [];
            
            const mainArtists = artists
                .filter(a => a.is_main_artist)
                .map(a => a.artists.name);
            const featuredArtists = artists
                .filter(a => !a.is_main_artist)
                .map(a => a.artists.name);

            if (featuredArtists.length > 0) {
                trackTitleWithFeatures += ` (ft. ${featuredArtists.join(', ')})`;
            }
            
            return {
                ...info,
                title: trackTitleWithFeatures,
                // Используем здесь только основных артистов для чистоты
                artistName: mainArtists.join(', ') || 'Неизвестный артист',
                coverUrl: getTransformedImageUrl(finalCoverUrl, { width: 180, height: 180, resize: 'cover' }),
                link: `track.html?id=${info.id}`
            };
        })
        .filter(Boolean) // 2. Отфильтровываем 'призрачные' записи, которые мы пометили как null
        .sort((a, b) => b.averageScore - a.averageScore);

        renderTopReleases(topTracksContainer, finalData, 'track');

    } catch (error) {
        console.error('Ошибка при загрузке лучших треков:', error);
        topTracksContainer.innerHTML = '<p>Не удалось загрузить данные.</p>';
    }
}

async function loadTopAlbums() {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: recentRatings, error: ratingsError } = await supabaseClient
            .from('album_ratings')
            .select('album_id, final_score, review_text, profiles(username)')
            .gt('created_at', thirtyDaysAgo.toISOString());
            
        if (ratingsError) throw ratingsError;
        
        const albumStats = recentRatings.reduce((acc, rating) => {
            const id = rating.album_id;
            if (!acc[id]) {
                acc[id] = {
                    scores: [],
                    topReview: { score: -1, text: null, author: null }
                };
            }
            acc[id].scores.push(rating.final_score);
            if (rating.final_score > acc[id].topReview.score) {
                 acc[id].topReview = { 
                    score: rating.final_score, 
                    text: rating.review_text,
                    author: rating.profiles?.username || 'Аноним'
                };
            }
            return acc;
        }, {});

        const albumScores = Object.keys(albumStats).map(id => {
            const stats = albumStats[id];
            const avgScore = stats.scores.reduce((sum, s) => sum + s, 0) / stats.scores.length;
            return {
                id: parseInt(id),
                averageScore: avgScore,
                topReview: stats.topReview
            };
        });

        const top5AlbumsInfo = albumScores
            .sort((a, b) => b.averageScore - a.averageScore)
            .slice(0, 5);

        if (top5AlbumsInfo.length === 0) {
            renderTopReleases(topAlbumsContainer, [], 'album');
            return;
        }

        const top5AlbumIds = top5AlbumsInfo.map(a => a.id);
        const { data: albums, error: albumsError } = await supabaseClient
            .from('albums')
            .select('id, title, cover_art_url, album_artists(artists(name))')
            .in('id', top5AlbumIds);

        if (albumsError) throw albumsError;
        
        const finalData = top5AlbumsInfo.map(info => {
            const albumData = albums.find(a => a.id === info.id);
            return {
                ...info,
                title: albumData.title,
                artistName: albumData.album_artists.map(a => a.artists.name).join(', ') || 'Неизвестный артист',
                coverUrl: getTransformedImageUrl(albumData.cover_art_url, { width: 180, height: 180, resize: 'cover' }),
                link: `album.html?id=${info.id}`
            };
        }).sort((a, b) => b.averageScore - a.averageScore);

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
    } else {
        console.log('Пользователь авторизован:', session.user.email);
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
                // На этом этапе можно отобразить сообщение об ошибке в соответствующем блоке
            }
        });
        
        handleAnnouncements();
        initializeScrollers();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    checkAuthAndLoadContent();
});