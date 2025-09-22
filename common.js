// --- ВРЕМЕННАЯ ПЕРЕАДРЕСАЦИЯ: Чтобы вернуть сайт в рабочее состояние, закомментируйте или удалите следующий блок кода ---
if (!window.location.pathname.endsWith('/404.html')) {
    window.location.href = '404.html';
}

// ОБЩАЯ НАСТРОЙКА SUPABASE
const SUPABASE_URL = 'https://texytgcdtafeejqxftqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRleHl0Z2NkdGFmZWVqcXhmdHFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1NTM2MjUsImV4cCI6MjA3MjEyOTYyNX0.1hWMcDYm4JdWjDKTvS_7uBatorByAK6RtN9LYljpacc';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- ДАННЫЕ О ДОСТИЖЕНИЯХ ---
const achievementsData = [
    // --- ПРОСТЫЕ ---
    { id: 'debutant', group: 'simple', icon: '🏆', title: 'Дебютант', description: 'Оставить свою первую оценку для любого трека или альбома.' },
    { id: 'album_lover', group: 'simple', icon: '💿', title: 'Альбомовед', description: 'Оценить свой первый альбом.' },
    { id: 'self_expression', group: 'simple', icon: '🎨', title: 'Самовыражение', description: 'Установить и имя пользователя, и аватар в профиле.' },
    { id: 'harsh', group: 'simple', icon: '🌶️', title: 'Жёстко...', description: 'Поставить оценку ниже 10 баллов.' },
    { id: 'high_score', group: 'simple', icon: '🌟', title: 'Высший балл', description: 'Поставить любому релизу оценку 28 или выше.' },
    { id: 'classic', group: 'simple', icon: '📜', title: 'Классика', description: 'Оценить релиз, вышедший до 2010 года.' },
    { id: 'hall_of_fame', group: 'simple', icon: '🏛️', title: 'Зал славы', description: 'Оценить альбом, находящийся в "Зале Легенд".' },
    // --- СЛОЖНЫЕ ---
    { id: 'critic', group: 'complex', icon: '✍️', title: 'Критик', description: 'Написать 10 развернутых рецензий.' },
    { id: 'music_lover', group: 'complex', icon: '🎧', title: 'Меломан', description: 'Оценить 50 разных треков.' },
    { id: 'connoisseur', group: 'complex', icon: '🧐', title: 'Ценитель', description: 'Оценить 10 релизов (треков или альбомов) одного артиста.' },
    { id: 'spectrum', group: 'complex', icon: '📊', title: 'Спектр', description: 'Иметь оценки в диапазонах: ниже 10, 15-20 и выше 25.' },
    { id: 'discography', group: 'complex', icon: '📚', title: 'Дискография', description: 'Оценить 3 разных альбома одного исполнителя.' },
    { id: 'fresh', group: 'complex', icon: '✨', title: 'Свежак', description: 'Оценить релиз в течение 7 дней после его выхода.' },
    { id: 'essayist', group: 'complex', icon: '🖋️', title: 'Эссеист', description: 'Написать рецензию длиной более 500 символов.' },
    { id: 'time_machine', group: 'complex', icon: '⏳', title: 'Машина Времени', description: 'Оценить релизы из 4-х разных десятилетий.' },
    // --- ЛЕГЕНДАРНЫЕ ---
    { id: 'flawless', group: 'legendary', icon: '💎', title: 'Безупречно', description: 'Поставить оценку 30/30 любому треку.' },
    { id: 'cover_to_cover', group: 'legendary', icon: '📖', title: 'От корки до корки', description: 'Оценить все треки на одном альбоме (от 8 треков).', },
    { id: 'gold_standard', group: 'legendary', icon: '⚜️', title: 'Золотой стандарт', description: 'Иметь среднюю оценку > 20 при 100+ оцененных релизах.' },
    { id: 'legacy_keeper', group: 'legendary', icon: '👑', title: 'Хранитель наследия', description: 'Оценить 5 разных альбомов из "Зала Легенд".' },
    { id: 'encyclopedist', group: 'legendary', icon: '🌍', title: 'Энциклопедист', description: 'Оценить релизы от 50 разных исполнителей.' }
];

// --- ПРОВЕРКА И УВЕДОМЛЕНИЕ О ДОСТИЖЕНИЯХ ---
async function checkAndNotifyAchievements(userId) {
    const { data: earnedAchievements, error: earnedError } = await supabaseClient
        .from('user_achievements')
        .select('achievement_id')
        .eq('user_id', userId);

    if (earnedError) {
        console.error("Не удалось получить заработанные достижения:", earnedError);
        return;
    }
    const earnedIds = new Set(earnedAchievements.map(a => a.achievement_id));
    const stats = await fetchUserStatsForAchievements(userId);
    if (!stats) return;

    const newlyEarned = [];
    const achievementCheckFunctions = getAchievementCheckFunctions();
    achievementsData.forEach(ach => {
        if (!earnedIds.has(ach.id)) {
            if (achievementCheckFunctions[ach.id] && achievementCheckFunctions[ach.id](stats)) {
                newlyEarned.push(ach);
            }
        }
    });

    if (newlyEarned.length > 0) {
        console.log(`Новые достижения (${newlyEarned.length}):`, newlyEarned.map(a=>a.title).join(', '));
        const userAchievementsPayload = newlyEarned.map(ach => ({ user_id: userId, achievement_id: ach.id }));
        const notificationsPayload = newlyEarned.map(ach => ({
            recipient_user_id: userId,
            type: 'achievement_unlocked',
            content: `Вы получили новое достижение: <strong>${ach.title}</strong>!`,
            link_url: 'profile.html'
        }));

        const [{ error: achError }, { error: notifError }] = await Promise.all([
            supabaseClient.from('user_achievements').insert(userAchievementsPayload),
            supabaseClient.from('notifications').insert(notificationsPayload)
        ]);

        if (achError) console.error("Ошибка сохранения достижений:", achError);
        if (notifError) console.error("Ошибка создания уведомлений о достижениях:", notifError);
    }
}

async function fetchUserStatsForAchievements(userId) {
     try {
        const defaultAvatarUrl = 'https://texytgcdtafeejqxftqj.supabase.co/storage/v1/object/public/avatars/public/avatar.png';
        const [profileRes, trackRatingsRes, albumRatingsRes, legendaryAlbumsRes] = await Promise.all([
            supabaseClient.from('profiles').select('username, avatar_url').eq('id', userId).single(),
            supabaseClient.from('ratings').select('score, review_text, created_at, tracks!inner(id, release_date, track_artists!inner(artist_id))').eq('user_id', userId),
            supabaseClient.from('album_ratings').select('album_id, final_score, review_text, created_at, albums!inner(id, release_date, album_artists!inner(artist_id), tracks(id))').eq('user_id', userId),
            supabaseClient.from('album_ratings').select('album_id, final_score')
        ]);

        const profileData = { username: profileRes.data?.username, avatar_url: profileRes.data?.avatar_url !== defaultAvatarUrl ? profileRes.data?.avatar_url : null };
        const trackRatingsData = trackRatingsRes.data || [];
        const albumRatingsData = albumRatingsRes.data || [];
        const allRatings = [...trackRatingsData.map(r => r.score), ...albumRatingsData.map(r => r.final_score)];
        const allReviews = [...trackRatingsData.filter(r => r.review_text), ...albumRatingsData.filter(r => r.review_text)];
        const artistCounts = {};
        trackRatingsData.forEach(r => r.tracks.track_artists.forEach(a => artistCounts[a.artist_id] = (artistCounts[a.artist_id] || 0) + 1));
        albumRatingsData.forEach(r => r.albums.album_artists.forEach(a => artistCounts[a.artist_id] = (artistCounts[a.artist_id] || 0) + 1));
        const albumArtistCounts = {};
        albumRatingsData.forEach(r => r.albums.album_artists.forEach(a => albumArtistCounts[a.artist_id] = (albumArtistCounts[a.artist_id] || 0) + 1));
        const decades = new Set();
        [...trackRatingsData.map(r => r.tracks.release_date), ...albumRatingsData.map(r => r.albums.release_date)].forEach(dateStr => {
            if (dateStr) decades.add(Math.floor(new Date(dateStr).getFullYear() / 10) * 10);
        });
        let hasCoverToCover = false;
        for (const ar of albumRatingsData) {
            if (ar.albums.tracks.length >= 8) {
                const ratedTrackIds = new Set(trackRatingsData.map(r => r.tracks.id));
                if (ar.albums.tracks.every(t => ratedTrackIds.has(t.id))) {
                    hasCoverToCover = true;
                    break;
                }
            }
        }
        const albumScores = (legendaryAlbumsRes.data || []).reduce((acc, r) => { (acc[r.album_id] = acc[r.album_id] || []).push(r.final_score); return acc; }, {});
        const legendaryAlbumIds = Object.keys(albumScores).filter(id => albumScores[id].reduce((s, c) => s + c, 0) / albumScores[id].length > 27).map(id => parseInt(id));
        
        return {
            profile: profileData,
            totalRatings: allRatings.length,
            totalReviews: allReviews.length,
            trackRatingsCount: trackRatingsData.length,
            albumRatingsCount: albumRatingsData.length,
            allRatings: allRatings,
            allReviews: allReviews,
            trackRatingsData: trackRatingsData,
            albumRatingsData: albumRatingsData,
            artistCounts: artistCounts,
            albumArtistCounts: albumArtistCounts,
            decades: decades,
            hasCoverToCover: hasCoverToCover,
            legendaryAlbumIds: legendaryAlbumIds
        };
    } catch (error) {
        console.error("Ошибка при сборе статистики для достижений:", error);
        return null;
    }
}

function getAchievementCheckFunctions() {
    return {
        debutant: (stats) => stats.totalRatings > 0,
        critic: (stats) => stats.totalReviews >= 10,
        music_lover: (stats) => stats.trackRatingsCount >= 50,
        harsh: (stats) => stats.allRatings.some(s => s < 10),
        connoisseur: (stats) => Math.max(0, ...Object.values(stats.artistCounts)) >= 10,
        album_lover: (stats) => stats.albumRatingsCount > 0,
        self_expression: (stats) => stats.profile.username && stats.profile.avatar_url,
        high_score: (stats) => stats.allRatings.some(s => s >= 28),
        classic: (stats) => [...stats.trackRatingsData.map(r => r.tracks.release_date), ...stats.albumRatingsData.map(r => r.albums.release_date)].some(d => d && new Date(d).getFullYear() < 2010),
        hall_of_fame: (stats) => stats.albumRatingsData.some(r => stats.legendaryAlbumIds.includes(r.album_id)),
        spectrum: (stats) => stats.allRatings.some(s => s < 10) && stats.allRatings.some(s => s >= 15 && s <= 20) && stats.allRatings.some(s => s > 25),
        discography: (stats) => Math.max(0, ...Object.values(stats.albumArtistCounts)) >= 3,
        fresh: (stats) => stats.allReviews.some(r => {
            const releaseDate = r.tracks?.release_date || r.albums?.release_date;
            return releaseDate && (new Date(r.created_at) - new Date(releaseDate)) <= 7 * 24 * 60 * 60 * 1000;
        }),
        essayist: (stats) => stats.allReviews.some(r => r.review_text && r.review_text.length > 500),
        time_machine: (stats) => stats.decades.size >= 4,
        cover_to_cover: (stats) => stats.hasCoverToCover,
        gold_standard: (stats) => stats.totalRatings >= 100 && (stats.allRatings.reduce((a, b) => a + b, 0) / stats.totalRatings) > 20,
        legacy_keeper: (stats) => stats.albumRatingsData.filter(r => stats.legendaryAlbumIds.includes(r.album_id)).length >= 5,
        encyclopedist: (stats) => new Set(Object.keys(stats.artistCounts)).size >= 50,
        flawless: (stats) => stats.trackRatingsData.some(r => r.score === 30)
    };
}

function timeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " г. назад";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " мес. назад";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " д. назад";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " ч. назад";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " мин. назад";
    return "только что";
}

function getTransformedImageUrl(url, options) {
    if (!url || !url.startsWith(SUPABASE_URL)) return url;
    try {
        const urlObject = new URL(url);
        const pathSegments = urlObject.pathname.split('/');
        const publicIndex = pathSegments.indexOf('public');
        if (publicIndex === -1 || publicIndex + 1 >= pathSegments.length) return url;
        const bucketName = pathSegments[publicIndex + 1];
        const filePath = pathSegments.slice(publicIndex + 2).join('/');
        const { data } = supabaseClient.storage.from(bucketName).getPublicUrl(filePath, { transform: options });
        return data.publicUrl;
    } catch (error) {
        console.error('Ошибка при трансформации URL изображения:', error);
        return url;
    }
}

function getScoreColor(score, maxScore = 30) {
    if (score === null || score === undefined) return '#6c757d';
    const hue = (score / maxScore) * 120;
    return `hsl(${hue}, 90%, 40%)`;
}

function createCommentElement(profile, score, text, scoreMax = 30) {
    const element = document.createElement('div');
    element.className = 'review-item';

    const finalAvatarUrl = profile?.avatar_url || 'https://texytgcdtafeejqxftqj.supabase.co/storage/v1/object/public/avatars/public/avatar.png';
    const avatarUrl = getTransformedImageUrl(finalAvatarUrl, { width: 96, height: 96, resize: 'cover' });
    
    const avatarImg = document.createElement('img');
    avatarImg.src = avatarUrl;
    avatarImg.alt = "Аватар";
    avatarImg.className = 'review-item-avatar';
    avatarImg.loading = 'lazy';
    
    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'review-item-body';

    const headerDiv = document.createElement('div');
    headerDiv.className = 'review-item-header';

    const username = profile?.username || 'Аноним';
    let authorEl;
    if (profile?.id) {
        authorEl = document.createElement('a');
        authorEl.href = `user.html?id=${profile.id}`;
    } else {
        authorEl = document.createElement('span');
    }
    authorEl.className = 'review-item-author';
    authorEl.textContent = username;

    const scoreSpan = document.createElement('span');
    scoreSpan.className = 'review-item-score';
    scoreSpan.textContent = 'Оценка: ';

    const scoreStrong = document.createElement('strong');
    const scoreFormatted = Number(score).toFixed(2);
    scoreStrong.style.color = getScoreColor(scoreFormatted, scoreMax);
    scoreStrong.textContent = `${scoreFormatted} / ${scoreMax}`;
    
    scoreSpan.appendChild(scoreStrong);
    headerDiv.appendChild(authorEl);
    headerDiv.appendChild(scoreSpan);
    
    const reviewTextP = document.createElement('p');
    reviewTextP.className = 'review-item-text';
    reviewTextP.textContent = text || 'Пользователь не оставил рецензию.';

    bodyDiv.appendChild(headerDiv);
    bodyDiv.appendChild(reviewTextP);
    
    element.appendChild(avatarImg);
    element.appendChild(bodyDiv);

    return element;
}

const logoutButton = document.getElementById('logout-button');
if (logoutButton) {
    logoutButton.addEventListener('click', async (e) => {
        e.preventDefault();
        await supabaseClient.auth.signOut();
        window.location.href = 'login.html';
    });
}

const searchInput = document.getElementById('search-input');
const searchResultsContainer = document.getElementById('search-results-container');
if (searchInput && searchResultsContainer) {
    function debounce(func, delay = 300) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        };
    }

    function renderResults({ artists, albums, tracks }) {
        while (searchResultsContainer.firstChild) {
            searchResultsContainer.removeChild(searchResultsContainer.firstChild);
        }

        const iconArtist = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z" /></svg>`;
        const iconAlbum = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,10A2,2 0 0,1 14,12A2,2 0 0,1 12,14A2,2 0 0,1 10,12A2,2 0 0,1 12,10M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4Z" /></svg>`;
        const iconTrack = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12,3V12.26C11.5,12.09 11,12 10.5,12C8,12 6,14 6,16.5C6,19 8,21 10.5,21C13,21 15,19 15,16.5V6H18V3H12Z" /></svg>`;

        if (!artists.length && !albums.length && !tracks.length) {
            const noResults = document.createElement('div');
            noResults.className = 'search-no-results';
            noResults.textContent = 'Ничего не найдено';
            searchResultsContainer.appendChild(noResults);
            return;
        }

        const getArtistNames = (item) => {
            if (item.album_artists) return item.album_artists.map(a => a.artists.name).join(', ');
            if (item.track_artists) return item.track_artists.map(a => a.artists.name).join(', ');
            return '';
        };

        const createItem = (item, type) => {
            const link = document.createElement('a');
            link.href = `${type}.html?id=${item.id}`;
            link.className = 'search-result-item';
            link.title = item.name || item.title;

            const iconDiv = document.createElement('div');
            iconDiv.className = 'search-item-icon';
            const icon = type === 'artist' ? iconArtist : (type === 'album' ? iconAlbum : iconTrack);
            iconDiv.innerHTML = icon;

            const infoDiv = document.createElement('div');
            infoDiv.className = 'search-item-info';

            const titleSpan = document.createElement('span');
            titleSpan.className = 'search-item-title';
            titleSpan.textContent = item.name || item.title;
            infoDiv.appendChild(titleSpan);

            const artistNameText = getArtistNames(item);
            if(artistNameText){
                const artistSpan = document.createElement('span');
                artistSpan.className = 'search-item-artist';
                artistSpan.textContent = artistNameText;
                infoDiv.appendChild(artistSpan);
            }
            
            link.appendChild(iconDiv);
            link.appendChild(infoDiv);
            return link;
        };

        const createCategory = (title, items, type) => {
            if (items.length) {
                const titleDiv = document.createElement('div');
                titleDiv.className = 'search-category-title';
                titleDiv.textContent = title;
                searchResultsContainer.appendChild(titleDiv);
                items.forEach(item => searchResultsContainer.appendChild(createItem(item, type)));
            }
        };

        createCategory('Артисты', artists, 'artist');
        createCategory('Альбомы', albums, 'album');
        createCategory('Треки', tracks, 'track');
    }

    async function performSearch(query) {
        if (query.length < 2) {
            searchResultsContainer.style.display = 'none';
            return;
        }
        searchResultsContainer.style.display = 'block';
        const searching = document.createElement('div');
        searching.className = 'search-no-results';
        searching.textContent = 'Идет поиск...';
        while (searchResultsContainer.firstChild) {
            searchResultsContainer.removeChild(searchResultsContainer.firstChild);
        }
        searchResultsContainer.appendChild(searching);

        try {
            const [artistsRes, albumsRes, tracksRes] = await Promise.all([
                supabaseClient.from('artists').select('id, name').ilike('name', `%${query}%`).limit(3),
                supabaseClient.from('albums').select('id, title, album_artists(artists(name))').ilike('title', `%${query}%`).limit(5),
                supabaseClient.from('tracks').select('id, title, track_artists(artists(name))').ilike('title', `%${query}%`).limit(5)
            ]);
            renderResults({ artists: artistsRes.data, albums: albumsRes.data, tracks: tracksRes.data });
        } catch (error) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'search-no-results';
            errorDiv.textContent = 'Ошибка поиска';
            while (searchResultsContainer.firstChild) {
                searchResultsContainer.removeChild(searchResultsContainer.firstChild);
            }
            searchResultsContainer.appendChild(errorDiv);
        }
    }
    
    searchInput.addEventListener('input', debounce((e) => performSearch(e.target.value.trim())));
    searchInput.addEventListener('focus', () => { if (searchInput.value.length >= 2) searchResultsContainer.style.display = 'block'; });
    document.addEventListener('click', (e) => { if (!e.target.closest('#search-container')) searchResultsContainer.style.display = 'none'; });
}

const notificationsContainer = document.getElementById('notifications-container');
if (notificationsContainer) {
    const bellButton = document.getElementById('notification-bell-button');
    const countBadge = document.getElementById('notifications-count');
    const dropdown = document.getElementById('notifications-dropdown');
    const notificationsList = document.getElementById('notifications-list');
    
    function renderNotifications(notifications) {
        while (notificationsList.firstChild) {
            notificationsList.removeChild(notificationsList.firstChild);
        }
        
        if (!notifications || notifications.length === 0) {
            const noNotif = document.createElement('p');
            noNotif.className = 'no-notifications';
            noNotif.textContent = 'Уведомлений пока нет.';
            notificationsList.appendChild(noNotif);
            return;
        }
        const lastReadTimestamp = parseInt(localStorage.getItem('notifications_last_read_timestamp') || '0');
        notifications.forEach(notif => {
            const creator = notif.creator_user_id;
            const finalAvatarUrl = creator?.avatar_url || 'https://texytgcdtafeejqxftqj.supabase.co/storage/v1/object/public/avatars/public/avatar.png';
            const avatarUrl = getTransformedImageUrl(finalAvatarUrl, { width: 80, height: 80, resize: 'cover' });
            
            const item = document.createElement('a');
            item.href = notif.link_url || '#';
            item.className = 'notification-item';
            if (new Date(notif.created_at).getTime() > lastReadTimestamp) {
                item.classList.add('is-unread');
            }

            const img = document.createElement('img');
            img.src = avatarUrl;
            img.alt = 'Аватар';
            img.className = 'notification-avatar';
            
            const bodyDiv = document.createElement('div');
            bodyDiv.className = 'notification-body';

            const contentP = document.createElement('p');
            contentP.className = 'notification-content';
            contentP.innerHTML = notif.content;

            const dateP = document.createElement('p');
            dateP.className = 'notification-date';
            dateP.textContent = timeAgo(notif.created_at);

            bodyDiv.appendChild(contentP);
            bodyDiv.appendChild(dateP);
            item.appendChild(img);
            item.appendChild(bodyDiv);
            notificationsList.appendChild(item);
        });
    }

    function updateUnreadCount(notifications) {
        const lastReadTimestamp = parseInt(localStorage.getItem('notifications_last_read_timestamp') || '0');
        const unread = notifications.filter(n => new Date(n.created_at).getTime() > lastReadTimestamp);
        if (unread.length > 0) {
            countBadge.textContent = unread.length > 9 ? '9+' : unread.length;
            countBadge.classList.add('is-visible');
        } else {
            countBadge.classList.remove('is-visible');
        }
    }
    
    function markNotificationsAsRead() {
        localStorage.setItem('notifications_last_read_timestamp', Date.now().toString());
        countBadge.classList.remove('is-visible');
        document.querySelectorAll('.notification-item.is-unread').forEach(item => item.classList.remove('is-unread'));
    }

    bellButton.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('is-visible');
        markNotificationsAsRead();
    });

    document.addEventListener('click', (e) => { if (!notificationsContainer.contains(e.target)) dropdown.classList.remove('is-visible'); });

    async function initializeNotifications() {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) return;
        const { data, error } = await supabaseClient.from('notifications')
            .select(`*, creator_user_id ( username, avatar_url )`)
            .eq('recipient_user_id', session.user.id)
            .order('created_at', { ascending: false }).limit(15);
        if (error) {
            while (notificationsList.firstChild) {
                notificationsList.removeChild(notificationsList.firstChild);
            }
            const errorP = document.createElement('p');
            errorP.className = 'no-notifications';
            errorP.textContent = 'Ошибка загрузки.';
            notificationsList.appendChild(errorP);
            return;
        }
        renderNotifications(data);
        updateUnreadCount(data);
    }
    initializeNotifications();
}

/**
 * Traps focus within a given element.
 * @param {HTMLElement} element The element to trap focus in.
 * @returns {Function} A cleanup function to remove the event listeners.
 */
function trapFocus(element) {
    const focusableEls = element.querySelectorAll(
        'a[href]:not([disabled]), button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusableEl = focusableEls[0];
    const lastFocusableEl = focusableEls[focusableEls.length - 1];
    const KEYCODE_TAB = 9;

    // Set initial focus
    if (firstFocusableEl) {
       setTimeout(() => firstFocusableEl.focus(), 50);
    }

    const handleKeyDown = (e) => {
        const isTabPressed = (e.key === 'Tab' || e.keyCode === KEYCODE_TAB);
        if (!isTabPressed) return;

        if (e.shiftKey) { // shift + tab
            if (document.activeElement === firstFocusableEl) {
                lastFocusableEl.focus();
                e.preventDefault();
            }
        } else { // tab
            if (document.activeElement === lastFocusableEl) {
                firstFocusableEl.focus();
                e.preventDefault();
            }
        }
    };
    
    element.addEventListener('keydown', handleKeyDown);
    
    return () => {
        element.removeEventListener('keydown', handleKeyDown);
    };
}


// --- HAMBURGER MENU TOGGLE ---
document.addEventListener('DOMContentLoaded', () => {
    const menuToggleButton = document.getElementById('menu-toggle-button');
    const mainNav = document.getElementById('main-nav');
    const menuOverlay = document.querySelector('.menu-overlay');

    if (menuToggleButton && mainNav && menuOverlay) {
        const toggleMenu = () => {
            // --- ИЗМЕНЕНИЕ: Закрываем уведомления при открытии меню ---
            const notificationsDropdown = document.getElementById('notifications-dropdown');
            if (notificationsDropdown) {
                notificationsDropdown.classList.remove('is-visible');
            }
            // --- КОНЕЦ ИЗМЕНЕНИЯ ---

            const isOpen = mainNav.classList.toggle('is-open');
            menuOverlay.classList.toggle('is-visible', isOpen);
            document.body.classList.toggle('menu-open', isOpen);
            menuToggleButton.setAttribute('aria-expanded', isOpen);
        };

        const closeMenu = () => {
            if (mainNav.classList.contains('is-open')) {
                mainNav.classList.remove('is-open');
                menuOverlay.classList.remove('is-visible');
                document.body.classList.remove('menu-open');
                menuToggleButton.setAttribute('aria-expanded', 'false');
            }
        };

        menuToggleButton.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMenu();
        });

        menuOverlay.addEventListener('click', closeMenu);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && mainNav.classList.contains('is-open')) {
                closeMenu();
            }
        });
    }
});