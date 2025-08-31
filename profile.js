// --- ИНИЦИАЛИЗАЦИЯ СТРАНИЦЫ ---
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { 
        window.location.href = 'login.html'; 
        return; 
    }
    const currentUser = session.user;

    initializeProfileEditor(currentUser);
    initializeTrackRatings(currentUser);
    initializeAlbumRatings(currentUser);
    initializeRatingEditModal(currentUser);
});


// --- КОМПОНЕНТ: INLINE РЕДАКТОР ПРОФИЛЯ ---
function initializeProfileEditor(user) {
    const profileCard = document.getElementById('profile-details-section');
    const profileUsername = document.getElementById('profile-username');
    const profileAvatar = document.getElementById('profile-avatar');
    
    // Элементы управления
    const editProfileButton = document.getElementById('edit-profile-button');
    const saveProfileButton = document.getElementById('save-profile-button');
    const cancelEditButton = document.getElementById('cancel-edit-button');
    const editAvatarButton = document.getElementById('edit-avatar-button');
    
    // Элементы формы
    const usernameInput = document.getElementById('username-input');
    const avatarInput = document.getElementById('avatar-input');
    const updateStatus = document.getElementById('update-status');
    
    let currentAvatarUrl = null;
    let originalUsername = '';
    let originalAvatarSrc = '';

    // 1. Загрузка данных
    async function fetchProfileData() {
        try {
            const { data, error } = await supabaseClient.from('profiles').select('username, avatar_url').eq('id', user.id).single();
            if (error) throw error;

            if (data) {
                originalUsername = data.username || 'Имя не указано';
                currentAvatarUrl = data.avatar_url;
                
                // ИЗМЕНЕНИЕ: Загружаем оптимизированную версию аватара (120px -> 240px)
                originalAvatarSrc = getTransformedImageUrl(data.avatar_url, { width: 240, height: 240, resize: 'cover' }) || 'https://via.placeholder.com/150';
                
                profileUsername.textContent = originalUsername;
                profileAvatar.src = originalAvatarSrc;
            }
        } catch (error) {
            console.error('Ошибка загрузки профиля:', error);
            profileUsername.textContent = 'Не удалось загрузить профиль';
        }
    }

    // 2. Функции переключения режимов
    function enterEditMode() {
        usernameInput.value = originalUsername;
        profileCard.classList.add('is-editing');
        usernameInput.focus();
    }

    function exitEditMode(revertChanges = false) {
        if (revertChanges) {
            profileAvatar.src = originalAvatarSrc; 
            avatarInput.value = ''; 
        }
        profileCard.classList.remove('is-editing');
        updateStatus.textContent = '';
    }

    // 3. Обработка сохранения
    async function handleSave() {
        saveProfileButton.disabled = true;
        cancelEditButton.disabled = true;
        updateStatus.textContent = 'Сохранение...';
        updateStatus.style.color = 'var(--text-color-secondary)';

        try {
            const newUsername = usernameInput.value.trim();
            const file = avatarInput.files[0];
            let newAvatarPublicUrl = null;
            let oldAvatarPath = null;
            
            if (currentAvatarUrl) {
                try {
                    // Извлекаем путь к файлу из полного URL
                    oldAvatarPath = new URL(currentAvatarUrl).pathname.split('/avatars/')[1];
                } catch(e) { 
                    console.error("Не удалось распарсить старый URL аватара:", e); 
                }
            }

            // Шаг 1: Если есть новый файл, загружаем его
            if (file) {
                const fileExt = file.name.split('.').pop();
                const safeFileName = `${user.id}-${Date.now()}.${fileExt}`;
                const filePath = `public/${safeFileName}`;
                
                const { error: uploadError } = await supabaseClient.storage.from('avatars').upload(filePath, file);
                if (uploadError) throw new Error(`Ошибка загрузки файла: ${uploadError.message}`);
                
                const { data } = supabaseClient.storage.from('avatars').getPublicUrl(filePath);
                newAvatarPublicUrl = data.publicUrl;
            }

            // Шаг 2: Готовим и отправляем обновления в базу данных
            const updates = { username: newUsername, updated_at: new Date() };
            if (newAvatarPublicUrl) {
                updates.avatar_url = newAvatarPublicUrl;
            }

            const { error: updateError } = await supabaseClient.from('profiles').update(updates).eq('id', user.id);
            if (updateError) throw updateError;
            
            // Шаг 3: Только после успешного обновления профиля, удаляем старый аватар
            if (newAvatarPublicUrl && oldAvatarPath) {
                const { error: removeError } = await supabaseClient.storage.from('avatars').remove([oldAvatarPath]);
                if (removeError) {
                    console.error("Не удалось удалить старый аватар, но профиль обновлен:", removeError);
                }
            }

            updateStatus.textContent = 'Профиль успешно обновлен!';
            updateStatus.style.color = 'green';
            
            // Обновляем локальные переменные для следующего редактирования
            originalUsername = newUsername;
            profileUsername.textContent = newUsername;
            if (newAvatarPublicUrl) {
                // ИЗМЕНЕНИЕ: Отображаем сразу оптимизированный аватар
                originalAvatarSrc = getTransformedImageUrl(newAvatarPublicUrl, { width: 240, height: 240, resize: 'cover' });
                currentAvatarUrl = newAvatarPublicUrl;
                profileAvatar.src = originalAvatarSrc;
            }
            setTimeout(() => exitEditMode(), 2000);

        } catch (error) {
            console.error('Ошибка сохранения профиля:', error);
            updateStatus.textContent = `Ошибка: ${error.message}`;
            updateStatus.style.color = 'var(--error-color)';
        } finally {
            // Гарантированно разблокируем кнопки
            saveProfileButton.disabled = false;
            cancelEditButton.disabled = false;
        }
    }

    // 4. Назначение обработчиков событий
    editProfileButton.addEventListener('click', enterEditMode);
    cancelEditButton.addEventListener('click', () => exitEditMode(true));
    saveProfileButton.addEventListener('click', handleSave);
    editAvatarButton.addEventListener('click', () => avatarInput.click()); 

    avatarInput.addEventListener('change', () => {
        const file = avatarInput.files[0];
        if (file) {
            // Показываем превью нового аватара
            profileAvatar.src = URL.createObjectURL(file);
        }
    });

    fetchProfileData();
}

// --- КОМПОНЕНТ: ОЦЕНКИ ТРЕКОВ ---
function initializeTrackRatings(user) {
    const trackRatingsList = document.getElementById('track-ratings-list');
    if (!trackRatingsList) return;

    async function fetchAndRender() {
        const { data, error } = await supabaseClient
            .from('ratings')
            .select(`id, score, review_text, tracks(id, title, albums(cover_art_url))`)
            .eq('user_id', user.id)
            .order('id', { ascending: false }); // Сортируем по последним

        trackRatingsList.innerHTML = '';
        if (error) {
            console.error('Ошибка загрузки оценок треков:', error);
            trackRatingsList.innerHTML = '<p>Не удалось загрузить оценки.</p>';
            return;
        }

        if (data && data.length > 0) {
            data.forEach(rating => {
                if (!rating.tracks) return; // Пропускаем оценки для удаленных треков
                const item = document.createElement('div');
                item.className = 'review-item'; 
                
                const reviewText = rating.review_text || '';
                const reviewHtml = reviewText ? `<p class="review-item-text">"${reviewText}"</p>` : '';
                
                // ИЗМЕНЕНИЕ: Оптимизируем обложку в списке (60px -> 120px)
                const coverUrl = getTransformedImageUrl(rating.tracks.albums?.cover_art_url, { width: 120, height: 120, resize: 'cover' }) || 'https://via.placeholder.com/60';

                // ИЗМЕНЕНИЕ: Заменяем кнопки на иконки
                item.innerHTML = `
                    <img src="${coverUrl}" alt="Обложка" class="review-item-cover">
                    <div class="review-item-body">
                        <div class="review-item-header">
                            <a href="track.html?id=${rating.tracks.id}" class="review-item-title">${rating.tracks.title}</a>
                            <span class="review-item-score">Ваша оценка: <strong>${rating.score}/30</strong></span>
                        </div>
                        ${reviewHtml}
                    </div>
                    <div class="review-item-controls">
                        <a class="icon-button edit-btn" title="Изменить" data-id="${rating.id}" data-score="${rating.score}" data-review="${encodeURIComponent(reviewText)}">
                            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.13,5.12L18.88,8.87M3,17.25V21H6.75L17.81,9.94L14.06,6.19L3,17.25Z"></path></svg>
                        </a>
                        <a class="icon-button delete-btn" title="Удалить" data-id="${rating.id}">
                            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"></path></svg>
                        </a>
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

        target.style.pointerEvents = 'none'; // Блокируем кнопку на время операции

        if (target.classList.contains('delete-btn')) {
            if (confirm('Вы уверены, что хотите удалить эту оценку?')) {
                const { error } = await supabaseClient.from('ratings').delete().eq('id', target.dataset.id);
                if (error) {
                    alert('Не удалось удалить оценку.');
                    console.error('Ошибка удаления:', error);
                } else {
                    fetchAndRender(); // Перерисовываем список
                }
            }
        }
        if (target.classList.contains('edit-btn')) {
            document.dispatchEvent(new CustomEvent('openEditModal', { 
                detail: { 
                    id: target.dataset.id, 
                    score: target.dataset.score,
                    review: decodeURIComponent(target.dataset.review)
                } 
            }));
        }

        target.style.pointerEvents = 'auto'; // Разблокируем кнопку
    });
    
    document.addEventListener('ratingUpdated', fetchAndRender);
    fetchAndRender();
}

// --- КОМПОНЕНТ: ОЦЕНКИ АЛЬБОМОВ ---
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

                // ИЗМЕНЕНИЕ: Оптимизируем обложку в списке (60px -> 120px)
                const coverUrl = getTransformedImageUrl(rating.albums.cover_art_url, { width: 120, height: 120, resize: 'cover' }) || 'https://via.placeholder.com/60';
                
                // ИЗМЕНЕНИЕ: Заменяем кнопки на иконки
                item.innerHTML = `
                    <img src="${coverUrl}" alt="Обложка" class="review-item-cover">
                    <div class="review-item-body">
                         <div class="review-item-header">
                            <a href="album.html?id=${rating.albums.id}" class="review-item-title">${rating.albums.title}</a>
                            <span class="review-item-score">Ваша оценка: <strong>${parseFloat(rating.final_score).toFixed(2)}/30</strong></span>
                        </div>
                        ${reviewHtml}
                    </div>
                    <div class="review-item-controls">
                        <a href="album.html?id=${rating.albums.id}" class="icon-button" title="Изменить">
                            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.13,5.12L18.88,8.87M3,17.25V21H6.75L17.81,9.94L14.06,6.19L3,17.25Z"></path></svg>
                        </a>
                        <a class="icon-button delete-btn" title="Удалить" data-id="${rating.id}">
                             <svg viewBox="0 0 24 24"><path fill="currentColor" d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"></path></svg>
                        </a>
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
                if (error) {
                    alert('Не удалось удалить оценку.');
                    console.error('Ошибка удаления:', error);
                } else {
                    fetchAndRender();
                }
                target.style.pointerEvents = 'auto';
            }
        }
    });

    fetchAndRender();
}

// --- КОМПОНЕНТ: МОДАЛЬНОЕ ОКНО РЕДАКТИРОВАНИЯ ОЦЕНКИ ТРЕКА ---
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
        const updateData = {
            score: editScoreInput.value,
            review_text: editReviewInput.value.trim() || null
        };
        
        const { error } = await supabaseClient.from('ratings').update(updateData).eq('id', editRatingIdInput.value);
        
        if (error) {
            alert('Не удалось обновить оценку.');
            console.error('Ошибка обновления:', error);
        } else {
            closeModal();
            // Отправляем событие, чтобы список оценок обновился
            document.dispatchEvent(new Event('ratingUpdated'));
        }
        submitButton.disabled = false;
    });

    cancelEditBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });
}