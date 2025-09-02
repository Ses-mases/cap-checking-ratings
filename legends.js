// ЭЛЕМЕНТЫ DOM
const legendsContainer = document.getElementById('legends-grid-container');

// ФУНКЦИЯ ОТОБРАЖЕНИЯ АЛЬБОМОВ
function renderLegendaryAlbums(albums) {
    legendsContainer.innerHTML = '';

    if (!albums || albums.length === 0) {
        legendsContainer.innerHTML = '<p>Пока ни один альбом не достиг легендарного статуса. Все впереди!</p>';
        return;
    }

    albums.forEach(album => {
        const cardLink = document.createElement('a');
        cardLink.href = `album.html?id=${album.id}`;
        cardLink.classList.add('card-link');
        
        const coverSource = getTransformedImageUrl(album.cover_art_url, { width: 500, height: 500, resize: 'cover' }) || 'https://via.placeholder.com/250';

        const artistName = album.album_artists.map(a => a.artists.name).join(', ') || 'Неизвестный артист';

        cardLink.innerHTML = `
            <div class="card">
                <img src="${coverSource}" alt="Обложка альбома ${album.title}" loading="lazy">
                <div class="card-body">
                    <h3>${album.title}</h3>
                    <p>${artistName}</p>
                    <p class="legend-score">Средняя оценка: <strong>${album.averageScore.toFixed(2)}</strong></p>
                </div>
            </div>
        `;
        legendsContainer.appendChild(cardLink);
    });
}

// ФУНКЦИЯ ЗАГРУЗКИ ДАННЫХ
async function loadLegendsData() {
    try {
        const { data: ratings, error: ratingsError } = await supabaseClient
            .from('album_ratings')
            .select('album_id, final_score');

        if (ratingsError) throw ratingsError;

        // Группируем оценки по ID альбома
        const albumStats = ratings.reduce((acc, rating) => {
            const id = rating.album_id;
            if (!acc[id]) {
                acc[id] = { scores: [] };
            }
            acc[id].scores.push(rating.final_score);
            return acc;
        }, {});

        // Вычисляем средний балл и фильтруем альбомы
        const legendaryAlbumScores = Object.keys(albumStats).map(id => {
            const stats = albumStats[id];
            const avgScore = stats.scores.reduce((sum, s) => sum + s, 0) / stats.scores.length;
            return {
                id: parseInt(id),
                averageScore: avgScore
            };
        }).filter(album => album.averageScore > 27);

        if (legendaryAlbumScores.length === 0) {
            renderLegendaryAlbums([]);
            return;
        }
        
        // Сортируем по убыванию оценки
        legendaryAlbumScores.sort((a, b) => b.averageScore - a.averageScore);

        const legendaryAlbumIds = legendaryAlbumScores.map(a => a.id);

        // Запрашиваем информацию по отфильтрованным альбомам
        const { data: albums, error: albumsError } = await supabaseClient
            .from('albums')
            .select('id, title, cover_art_url, album_artists(artists(name))')
            .in('id', legendaryAlbumIds);

        if (albumsError) throw albumsError;
        
        // Объединяем информацию об альбомах с их легендарной оценкой
        const finalData = albums.map(albumData => {
            const scoreInfo = legendaryAlbumScores.find(s => s.id === albumData.id);
            return {
                ...albumData,
                averageScore: scoreInfo.averageScore
            };
        }).sort((a, b) => b.averageScore - a.averageScore);

        renderLegendaryAlbums(finalData);

    } catch (error) {
        console.error('Ошибка при загрузке Зала Легенд:', error);
        legendsContainer.innerHTML = '<p>Не удалось загрузить данные. Попробуйте обновить страницу.</p>';
    }
}


// ИНИЦИАЛИЗАЦИЯ СТРАНИЦЫ
async function initializePage() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }
    await loadLegendsData();
}

document.addEventListener('DOMContentLoaded', initializePage);