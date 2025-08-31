// --- 1. ОБЩАЯ НАСТРОЙКА SUPABASE ---
const SUPABASE_URL = 'https://texytgcdtafeejqxftqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRleHl0Z2NkdGFmZWVqcXhmdHFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1NTM2MjUsImV4cCI6MjA3MjEyOTYyNX0.1hWMcDYm4JdWjDKTvS_7uBatorByAK6RtN9LYljpacc';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- 2. НОВЫЕ ОБЩИЕ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
// ИЗМЕНЕНИЕ: Эти функции были дублированы в album.js и track.js. Теперь они в одном месте.
function getScoreColor(score, maxScore = 30) {
    if (score === null || score === undefined) return '#6c757d'; // Цвет по умолчанию
    const hue = (score / maxScore) * 120; // 0 = red, 120 = green
    return `hsl(${hue}, 90%, 40%)`;
}

function createCommentElement(profile, score, text, scoreMax = 30) {
    const element = document.createElement('div');
    element.className = 'review-item';
    const avatarUrl = profile?.avatar_url || 'https://via.placeholder.com/48';
    const username = profile?.username || 'Аноним';
    // ИЗМЕНЕНИЕ: Убрано лишнее преобразование в float, score уже число.
    const scoreFormatted = Number(score).toFixed(2);
    const reviewText = text || 'Пользователь не оставил рецензию.';

    element.innerHTML = `
        <img src="${avatarUrl}" alt="Аватар" class="review-item-avatar">
        <div class="review-item-body">
            <div class="review-item-header">
                <span class="review-item-author">${username}</span>
                <span class="review-item-score">Оценка: <strong style="color: ${getScoreColor(scoreFormatted, scoreMax)}">${scoreFormatted} / ${scoreMax}</strong></span>
            </div>
            <p class="review-item-text">${reviewText}</p>
        </div>`;
    return element;
}


// --- 3. ОБЩАЯ ЛОГИКА ВЫХОДА ИЗ СИСТЕМЫ ---
const logoutButton = document.getElementById('logout-button');
if (logoutButton) {
    logoutButton.addEventListener('click', async (e) => {
        e.preventDefault();
        const { error } = await supabaseClient.auth.signOut();
        if (error) {
            console.error('Ошибка выхода:', error);
        } else {
            window.location.href = 'login.html';
        }
    });
}


// --- 4. ОБЩАЯ ЛОГИКА ПОИСКА ---
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
        searchResultsContainer.innerHTML = '';

        const iconArtist = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z" /></svg>`;
        const iconAlbum = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,10A2,2 0 0,1 14,12A2,2 0 0,1 12,14A2,2 0 0,1 10,12A2,2 0 0,1 12,10M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4Z" /></svg>`;
        const iconTrack = `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12,3V12.26C11.5,12.09 11,12 10.5,12C8,12 6,14 6,16.5C6,19 8,21 10.5,21C13,21 15,19 15,16.5V6H18V3H12Z" /></svg>`;

        if (!artists.length && !albums.length && !tracks.length) {
            searchResultsContainer.innerHTML = '<div class="search-no-results">Ничего не найдено</div>';
            return;
        }

        const createItem = (item, type) => {
            const isArtist = type === 'artist';
            // ИЗМЕНЕНИЕ: Для артистов используется div, для остальных - ссылка
            const tag = isArtist ? 'div' : 'a'; 
            const href = isArtist ? '' : `href="${type}.html?id=${item.id}"`;
            const icon = type === 'artist' ? iconArtist : (type === 'album' ? iconAlbum : iconTrack);
            const artistName = item.artists ? `<span class="search-item-artist">${item.artists.name}</span>` : '';
            const title = item.name || item.title;

            // ИЗМЕНЕНИЕ: Добавлен title атрибут для всплывающей подсказки, если текст обрезан
            return `
                <${tag} ${href} class="search-result-item" title="${title}${item.artists ? ` - ${item.artists.name}` : ''}">
                    <div class="search-item-icon">${icon}</div>
                    <div class="search-item-info">
                        <span class="search-item-title">${title}</span>
                        ${artistName}
                    </div>
                </${tag}>
            `;
        };

        let html = '';
        if (artists.length) {
            html += '<div class="search-category-title">Артисты</div>';
            artists.forEach(a => { html += createItem(a, 'artist'); });
        }
        if (albums.length) {
            html += '<div class="search-category-title">Альбомы</div>';
            albums.forEach(a => { html += createItem(a, 'album'); });
        }
        if (tracks.length) {
            html += '<div class="search-category-title">Треки</div>';
            tracks.forEach(t => { html += createItem(t, 'track'); });
        }
        searchResultsContainer.innerHTML = html;
    }

    async function performSearch(query) {
        if (query.length < 2) {
            searchResultsContainer.style.display = 'none';
            return;
        }
        searchResultsContainer.style.display = 'block';
        searchResultsContainer.innerHTML = '<div class="search-no-results">Идет поиск...</div>';
        try {
            const [artistsRes, albumsRes, tracksRes] = await Promise.all([
                supabaseClient.from('artists').select('id, name').ilike('name', `%${query}%`).limit(3),
                supabaseClient.from('albums').select('id, title, artists(name)').ilike('title', `%${query}%`).limit(5),
                supabaseClient.from('tracks').select('id, title, artists(name)').ilike('title', `%${query}%`).limit(5)
            ]);
            
            // ИЗМЕНЕНИЕ: Более надежная проверка ошибок
            const errors = [artistsRes.error, albumsRes.error, tracksRes.error].filter(Boolean);
            if (errors.length > 0) {
                throw new Error(errors.map(e => e.message).join(', '));
            }

            renderResults({ artists: artistsRes.data, albums: albumsRes.data, tracks: tracksRes.data });
        } catch (error) {
            console.error('Ошибка поиска:', error);
            searchResultsContainer.innerHTML = '<div class="search-no-results">Ошибка поиска</div>';
        }
    }
    
    // ИЗМЕНЕНИЕ: Добавлена проверка фокуса для более интуитивного поведения
    searchInput.addEventListener('input', debounce((e) => performSearch(e.target.value.trim())));
    searchInput.addEventListener('focus', () => {
        if (searchInput.value.length >= 2) {
            searchResultsContainer.style.display = 'block';
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#search-container')) {
            searchResultsContainer.style.display = 'none';
        }
    });
}