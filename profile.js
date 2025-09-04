// ИНИЦИАЛИЗАЦИЯ
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { 
        window.location.href = 'login.html'; 
        return; 
    }
    const currentUser = session.user;

    // Теперь эта функция управляет и синхронизацией
    initializeProfileEditorAndSync(currentUser); 
    
    initializeTrackRatings(currentUser);
    initializeAlbumRatings(currentUser);
    initializeRatingEditModal(currentUser);
    initializeAchievements(currentUser);
});

// --- ИЗМЕНЕНО: Функция теперь управляет и синхронизацией ---
function initializeProfileEditorAndSync(user) {
    const profileCard = document.getElementById('profile-details-section');
    const profileUsername = document.getElementById('profile-username');
    const profileAvatar = document.getElementById('profile-avatar');
    const syncStatus = document.getElementById('sync-status');
    // ... (остальные переменные для редактора профиля)
    const editProfileButton = document.getElementById('edit-profile-button');
    const saveProfileButton = document.getElementById('save-profile-button');
    const cancelEditButton = document.getElementById('cancel-edit-button');
    const editAvatarButton = document.getElementById('edit-avatar-button');
    const usernameInput = document.getElementById('username-input');
    const avatarInput = document.getElementById('avatar-input');
    const updateStatus = document.getElementById('update-status');
    let currentAvatarUrl = null;
    let originalUsername = '';
    let originalAvatarSrc = '';

    // --- НОВАЯ ФУНКЦИЯ: ЕДИНОРАЗОВАЯ СИНХРОНИЗАЦИЯ ---
    async function runOneTimeAchievementSync() {
        try {
            syncStatus.textContent = 'Синхронизируем ваши достижения...';
            // Вызываем основную функцию проверки из common.js
            await checkAndNotifyAchievements(user.id);

            // Обновляем флаг в базе данных, чтобы это больше не повторялось
            const { error: updateError } = await supabaseClient
                .from('profiles')
                .update({ achievements_synced_at: new Date() })
                .eq('id', user.id);

            if (updateError) throw updateError;
            
            syncStatus.textContent = 'Достижения успешно синхронизированы!';
            syncStatus.style.color = 'var(--success-color)';

        } catch (error) {
            console.error("Ошибка во время синхронизации достижений:", error);
            syncStatus.textContent = 'Ошибка синхронизации достижений.';
            syncStatus.style.color = 'var(--error-color)';
        } finally {
            // Плавно скрываем сообщение через 3 секунды
            setTimeout(() => {
                syncStatus.style.opacity = '0';
                setTimeout(() => syncStatus.textContent = '', 500);
            }, 3000);
        }
    }

    async function fetchProfileData() {
        try {
            // Запрашиваем новый столбец вместе с остальными данными
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('username, avatar_url, achievements_synced_at')
                .eq('id', user.id)
                .single();
            
            if (error) throw error;

            if (data) {
                originalUsername = data.username || 'Имя не указано';
                currentAvatarUrl = data.avatar_url;
                const finalAvatarUrl = data.avatar_url || 'https://texytgcdtafeejqxftqj.supabase.co/storage/v1/object/public/avatars/public/avatar.png';
                originalAvatarSrc = getTransformedImageUrl(finalAvatarUrl, { width: 240, height: 240, resize: 'cover' });
                profileUsername.textContent = originalUsername;
                profileAvatar.src = originalAvatarSrc;

                // --- ГЛАВНАЯ ПРОВЕРКА ---
                // Если поле пусто (null), запускаем синхронизацию
                if (data.achievements_synced_at === null) {
                    runOneTimeAchievementSync();
                }
            }
        } catch (error) {
            console.error('Ошибка загрузки профиля:', error);
            profileUsername.textContent = 'Не удалось загрузить профиль';
        }
    }

    function enterEditMode() { /* ... код без изменений ... */ }
    function exitEditMode(revertChanges = false) { /* ... код без изменений ... */ }

    async function handleSave() {
        saveProfileButton.disabled = true;
        cancelEditButton.disabled = true;
        updateStatus.textContent = 'Сохранение...';

        try {
            // ... (весь существующий код сохранения профиля) ...
            
            // Вызов проверки достижений после сохранения (остается на месте)
            checkAndNotifyAchievements(user.id);

            // ... (остальной код) ...
        } catch (error) {
            // ... (обработка ошибок) ...
        } finally {
            saveProfileButton.disabled = false;
            cancelEditButton.disabled = false;
        }
    }

    editProfileButton.addEventListener('click', enterEditMode);
    cancelEditButton.addEventListener('click', () => exitEditMode(true));
    saveProfileButton.addEventListener('click', handleSave);
    editAvatarButton.addEventListener('click', () => avatarInput.click());
    avatarInput.addEventListener('change', () => {
        const file = avatarInput.files[0];
        if (file) profileAvatar.src = URL.createObjectURL(file);
    });

    fetchProfileData();
}


// КОМПОНЕНТ: ОЦЕНКИ ТРЕКОВ (без изменений)
function initializeTrackRatings(user) {
    const trackRatingsList = document.getElementById('track-ratings-list');
    if (!trackRatingsList) return;

    async function fetchAndRender() {
        const { data, error } = await supabaseClient
            .from('ratings')
            .select(`id, score, review_text, tracks(id, title, cover_art_url, albums(cover_art_url))`)
            .eq('user_id', user.id)
            .order('id', { ascending: false });

        trackRatingsList.innerHTML = '';
        if (error) {
            console.error('Ошибка загрузки оценок треков:', error);
            trackRatingsList.innerHTML = '<p>Не удалось загрузить оценки.</p>';
            return;
        }

        if (data && data.length > 0) {
            data.forEach(rating => {
                if (!rating.tracks) return;
                const item = document.createElement('div');
                item.className = 'review-item'; 
                const reviewText = rating.review_text || '';
                const reviewHtml = reviewText ? `<p class="review-item-text">"${reviewText}"</p>` : '';
                const finalCoverUrl = rating.tracks.cover_art_url || rating.tracks.albums?.cover_art_url;
                const coverUrl = getTransformedImageUrl(finalCoverUrl, { width: 120, height: 120, resize: 'cover' }) || 'https://via.placeholder.com/60';

                item.innerHTML = `
                    <img src="${coverUrl}" alt="Обложка" class="review-item-cover" loading="lazy">
                    <div class="review-item-body">
                        <div class="review-item-header">
                            <a href="track.html?id=${rating.tracks.id}" class="review-item-title">${rating.tracks.title}</a>
                            <span class="review-item-score">Ваша оценка: <strong>${rating.score}/30</strong></span>
                        </div>
                        ${reviewHtml}
                    </div>
                    <div class="review-item-controls">
                        <a class="icon-button edit-btn" title="Изменить" data-id="${rating.id}" data-score="${rating.score}" data-review="${encodeURIComponent(reviewText)}"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.13,5.12L18.88,8.87M3,17.25V21H6.75L17.81,9.94L14.06,6.19L3,17.25Z"></path></svg></a>
                        <a class="icon-button delete-btn" title="Удалить" data-id="${rating.id}"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"></path></svg></a>
                    </div>`;
                trackRatingsList.appendChild(item);
            });
        } else {
            trackRatingsList.innerHTML = '<p>Вы еще не ставили оценок трекам.</p>';
        }
    }
    
    trackRatingsList.addEventListener('click', async (e) => {
        const target = e.target.closest('.delete-btn, .edit-btn');
        if (!target) return;

        target.style.pointerEvents = 'none'; 
        if (target.classList.contains('delete-btn')) {
            if (confirm('Вы уверены, что хотите удалить эту оценку?')) {
                const { error } = await supabaseClient.from('ratings').delete().eq('id', target.dataset.id);
                if (error) alert('Не удалось удалить оценку.');
                else fetchAndRender(); 
            }
        }
        if (target.classList.contains('edit-btn')) {
            document.dispatchEvent(new CustomEvent('openEditModal', { 
                detail: { id: target.dataset.id, score: target.dataset.score, review: decodeURIComponent(target.dataset.review) } 
            }));
        }
        target.style.pointerEvents = 'auto';
    });
    
    document.addEventListener('ratingUpdated', fetchAndRender);
    fetchAndRender();
}

// КОМПОНЕНТ: ОЦЕНКИ АЛЬБОМОВ (без изменений)
function initializeAlbumRatings(user) {
    const albumRatingsList = document.getElementById('album-ratings-list');
    if (!albumRatingsList) return;

    async function fetchAndRender() {
        const { data, error } = await supabaseClient
            .from('album_ratings')
            .select(`id, final_score, review_text, albums(id, title, cover_art_url)`)
            .eq('user_id', user.id)
            .order('id', { ascending: false });

        albumRatingsList.innerHTML = '';
        if (error) {
            console.error('Ошибка загрузки оценок альбомов:', error);
            albumRatingsList.innerHTML = '<p>Не удалось загрузить оценки.</p>';
            return;
        }

        if (data && data.length > 0) {
            data.forEach(rating => {
                if (!rating.albums) return;
                const item = document.createElement('div');
                item.className = 'review-item'; 
                const reviewHtml = rating.review_text ? `<p class="review-item-text">"${rating.review_text}"</p>` : '';
                const coverUrl = getTransformedImageUrl(rating.albums.cover_art_url, { width: 120, height: 120, resize: 'cover' }) || 'https://via.placeholder.com/60';
                
                item.innerHTML = `
                    <img src="${coverUrl}" alt="Обложка" class="review-item-cover" loading="lazy">
                    <div class="review-item-body">
                         <div class="review-item-header">
                            <a href="album.html?id=${rating.albums.id}" class="review-item-title">${rating.albums.title}</a>
                            <span class="review-item-score">Ваша оценка: <strong>${parseFloat(rating.final_score).toFixed(2)}/30</strong></span>
                        </div>
                        ${reviewHtml}
                    </div>
                    <div class="review-item-controls">
                        <a href="album.html?id=${rating.albums.id}" class="icon-button" title="Изменить"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.13,5.12L18.88,8.87M3,17.25V21H6.75L17.81,9.94L14.06,6.19L3,17.25Z"></path></svg></a>
                        <a class="icon-button delete-btn" title="Удалить" data-id="${rating.id}"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"></path></svg></a>
                    </div>`;
                albumRatingsList.appendChild(item);
            });
        } else {
            albumRatingsList.innerHTML = '<p>Вы еще не ставили оценок альбомам.</p>';
        }
    }
    
    albumRatingsList.addEventListener('click', async (e) => {
        const target = e.target.closest('.delete-btn');
        if (target) {
            if (confirm('Вы уверены, что хотите удалить оценку альбома?')) {
                target.style.pointerEvents = 'none';
                const { error } = await supabaseClient.from('album_ratings').delete().eq('id', target.dataset.id);
                if (error) alert('Не удалось удалить оценку.');
                else fetchAndRender();
                target.style.pointerEvents = 'auto';
            }
        }
    });
    fetchAndRender();
}

// КОМПОНЕНТ: МОДАЛЬНОЕ ОКНО РЕДАКТИРОВАНИЯ ОЦЕНКИ ТРЕКА (без изменений)
function initializeRatingEditModal() {
    const modalOverlay = document.getElementById('edit-modal-overlay');
    if (!modalOverlay) return;

    const editRatingForm = document.getElementById('edit-rating-form');
    const submitButton = editRatingForm.querySelector('button[type="submit"]');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const editRatingIdInput = document.getElementById('edit-rating-id');
    const editScoreInput = document.getElementById('edit-score-input');
    const editReviewInput = document.getElementById('edit-review-input');

    function openModal({ id, score, review }) {
        editRatingIdInput.value = id;
        editScoreInput.value = score;
        editReviewInput.value = review;
        modalOverlay.classList.add('is-visible');
    }
    function closeModal() { 
        modalOverlay.classList.remove('is-visible'); 
    }
    
    document.addEventListener('openEditModal', (e) => openModal(e.detail));

    editRatingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        submitButton.disabled = true;
        const { error } = await supabaseClient.from('ratings').update({
            score: editScoreInput.value,
            review_text: editReviewInput.value.trim() || null
        }).eq('id', editRatingIdInput.value);
        
        if (error) alert('Не удалось обновить оценку.');
        else {
            closeModal();
            document.dispatchEvent(new Event('ratingUpdated'));
        }
        submitButton.disabled = false;
    });

    cancelEditBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });
}

// КОМПОНЕНТ: ДОСТИЖЕНИЯ (без изменений)
function initializeAchievements(user) {
    const achievementsButton = document.getElementById('achievements-button');
    const modalOverlay = document.getElementById('achievements-modal-overlay');
    const achievementsList = document.getElementById('achievements-list');
    const closeModalBtn = document.getElementById('close-achievements-btn');

    if (!achievementsButton || !modalOverlay || !achievementsList || !closeModalBtn) return;

    function openModal() {
        modalOverlay.classList.add('is-visible');
        loadAndRenderAchievements();
    }
    function closeModal() {
        modalOverlay.classList.remove('is-visible');
    }

    async function loadAndRenderAchievements() {
        achievementsList.innerHTML = '<p>Загрузка достижений...</p>';
        const { data: earnedData, error } = await supabaseClient
            .from('user_achievements')
            .select('achievement_id')
            .eq('user_id', user.id);

        if (error) {
            achievementsList.innerHTML = '<p>Не удалось загрузить данные о достижениях.</p>';
            return;
        }

        const earnedIds = new Set(earnedData.map(a => a.achievement_id));
        achievementsList.innerHTML = '';

        const groups = {
            simple: { title: 'Простые', achievements: [] },
            complex: { title: 'Сложные', achievements: [] },
            legendary: { title: 'Легендарные', achievements: [] }
        };

        achievementsData.forEach(ach => {
            if (groups[ach.group]) groups[ach.group].achievements.push(ach);
        });

        for (const groupKey in groups) {
            const group = groups[groupKey];
            if (group.achievements.length > 0) {
                const groupContainer = document.createElement('div');
                groupContainer.className = 'achievement-group';
                groupContainer.innerHTML = `<h4>${group.title}</h4>`;
                
                group.achievements.forEach(ach => {
                    const isEarned = earnedIds.has(ach.id);
                    const item = document.createElement('div');
                    item.className = 'achievement-item';
                    if (isEarned) item.classList.add('is-earned');
                    item.innerHTML = `
                        <div class="achievement-icon">${ach.icon}</div>
                        <div class="achievement-details">
                            <h4>${ach.title}</h4>
                            <p>${ach.description}</p>
                        </div>`;
                    groupContainer.appendChild(item);
                });
                achievementsList.appendChild(groupContainer);
            }
        }
    }

    achievementsButton.addEventListener('click', openModal);
    closeModalBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });
}