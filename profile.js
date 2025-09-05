// ИНИЦИАЛИЗАЦИЯ
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }
    const currentUser = session.user;

    await initializeProfile(currentUser);
    initializeTrackRatings(currentUser);
    initializeAlbumRatings(currentUser);
    initializeRatingEditModal();
    initializeAlbumRatingEditModal(); // <-- НОВЫЙ ВЫЗОВ
    initializeAchievements(currentUser);
});

// --- РЕДАКТОР ПРОФИЛЯ И СИНХРОНИЗАЦИЯ ---
async function initializeProfile(user) {
    const profileCard = document.getElementById('profile-details-section');
    const profileUsername = document.getElementById('profile-username');
    const profileAvatar = document.getElementById('profile-avatar');
    const syncStatus = document.getElementById('sync-status');
    const editProfileButton = document.getElementById('edit-profile-button');
    const saveProfileButton = document.getElementById('save-profile-button');
    const cancelEditButton = document.getElementById('cancel-edit-button');
    const editAvatarButton = document.getElementById('edit-avatar-button');
    const usernameInput = document.getElementById('username-input');
    const avatarInput = document.getElementById('avatar-input');
    const updateStatus = document.getElementById('update-status');
    let originalUsername = '';
    let originalAvatarSrc = '';
    
    const fetchProfileData = async () => {
        try {
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('username, avatar_url, achievements_synced_at')
                .eq('id', user.id)
                .single();

            if (error) throw error;

            if (data) {
                originalUsername = data.username || 'Имя не указано';
                const finalAvatarUrl = data.avatar_url || 'https://texytgcdtafeejqxftqj.supabase.co/storage/v1/object/public/avatars/public/avatar.png';
                originalAvatarSrc = getTransformedImageUrl(finalAvatarUrl, { width: 240, height: 240, resize: 'cover' });
                
                profileUsername.textContent = originalUsername;
                profileAvatar.src = originalAvatarSrc;
                usernameInput.value = originalUsername;

                if (data.achievements_synced_at === null) {
                    runOneTimeAchievementSync();
                }
            }
        } catch (error) {
            console.error('Ошибка загрузки профиля:', error);
            profileUsername.textContent = 'Не удалось загрузить профиль';
        }
    };

    const runOneTimeAchievementSync = async () => {
        try {
            syncStatus.textContent = 'Синхронизируем ваши достижения...';
            syncStatus.className = 'status-message';
            syncStatus.classList.add('sync-active');
            
            await checkAndNotifyAchievements(user.id);

            await supabaseClient
                .from('profiles')
                .update({ achievements_synced_at: new Date().toISOString() })
                .eq('id', user.id);

            syncStatus.textContent = 'Достижения успешно синхронизированы!';
            syncStatus.classList.add('success');

        } catch (error) {
            console.error("Ошибка во время синхронизации достижений:", error);
            syncStatus.textContent = 'Ошибка синхронизации достижений.';
            syncStatus.classList.add('error');
        } finally {
            setTimeout(() => {
                syncStatus.classList.remove('sync-active');
            }, 3000);
        }
    };

    const enterEditMode = () => {
        profileCard.classList.add('is-editing');
        usernameInput.value = originalUsername;
        profileAvatar.src = originalAvatarSrc;
    };

    const exitEditMode = (revertChanges = false) => {
        profileCard.classList.remove('is-editing');
        if (revertChanges) {
            profileUsername.textContent = originalUsername;
            profileAvatar.src = originalAvatarSrc;
        }
    };

    const handleSave = async () => {
        saveProfileButton.disabled = true;
        cancelEditButton.disabled = true;
        updateStatus.textContent = 'Сохранение...';
        updateStatus.className = 'status-message';
        let newAvatarUrl = null;

        try {
            const newUsername = usernameInput.value.trim();
            if (newUsername.length < 3) {
                throw new Error("Имя пользователя должно содержать не менее 3 символов.");
            }
            
            const file = avatarInput.files[0];
            if (file) {
                const compressedFile = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 800 });
                const filePath = `public/${user.id}-${Date.now()}`;
                const { data: uploadData, error: uploadError } = await supabaseClient.storage.from('avatars').upload(filePath, compressedFile);
                if (uploadError) throw uploadError;
                const { data: urlData } = supabaseClient.storage.from('avatars').getPublicUrl(uploadData.path);
                newAvatarUrl = urlData.publicUrl;
            }

            const updates = { username: newUsername };
            if (newAvatarUrl) {
                updates.avatar_url = newAvatarUrl;
            }

            const { error: updateError } = await supabaseClient.from('profiles').update(updates).eq('id', user.id);
            if (updateError) throw updateError;
            
            updateStatus.textContent = 'Профиль успешно обновлен!';
            updateStatus.classList.add('success');
            
            originalUsername = newUsername;
            if (newAvatarUrl) originalAvatarSrc = getTransformedImageUrl(newAvatarUrl, { width: 240, height: 240, resize: 'cover' });
            profileUsername.textContent = originalUsername;

            checkAndNotifyAchievements(user.id);
            
            exitEditMode();

        } catch (error) {
            console.error('Ошибка сохранения профиля:', error);
            updateStatus.textContent = error.message;
            updateStatus.classList.add('error');
        } finally {
            saveProfileButton.disabled = false;
            cancelEditButton.disabled = false;
        }
    };
    
    editProfileButton.addEventListener('click', enterEditMode);
    cancelEditButton.addEventListener('click', () => exitEditMode(true));
    saveProfileButton.addEventListener('click', handleSave);
    editAvatarButton.addEventListener('click', () => avatarInput.click());
    avatarInput.addEventListener('change', () => {
        const file = avatarInput.files[0];
        if (file) {
            profileAvatar.src = URL.createObjectURL(file);
        }
    });

    await fetchProfileData();
}

// КОМПОНЕНТ: ОЦЕНКИ ТРЕКОВ
function initializeTrackRatings(user) {
    const trackRatingsList = document.getElementById('track-ratings-list');
    const trackRatingsControls = document.getElementById('track-ratings-controls');
    if (!trackRatingsList || !trackRatingsControls) return;

    let currentPage = 0;
    const PAGE_SIZE = 15;
    let isLoading = false;
    let loadMoreButton;

    const loadMoreTracks = async () => {
        if (isLoading) return;
        isLoading = true;
        if(loadMoreButton) loadMoreButton.disabled = true;

        const from = currentPage * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const { data, error } = await supabaseClient
            .from('ratings')
            .select(`id, score, review_text, tracks(id, title, cover_art_url, albums(cover_art_url))`)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .range(from, to);

        if (currentPage === 0) {
            trackRatingsList.innerHTML = '';
        }

        if (error) {
            console.error('Ошибка загрузки оценок треков:', error);
            trackRatingsList.innerHTML = '<p>Не удалось загрузить оценки.</p>';
            isLoading = false;
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
                    <img src="${coverUrl}" alt="Обложка трека ${rating.tracks.title}" class="review-item-cover" loading="lazy">
                    <div class="review-item-body">
                        <div class="review-item-header">
                            <a href="track.html?id=${rating.tracks.id}" class="review-item-title">${rating.tracks.title}</a>
                            <span class="review-item-score">Ваша оценка: <strong>${rating.score}/30</strong></span>
                        </div>
                        ${reviewHtml}
                    </div>
                    <div class="review-item-controls">
                        <button class="icon-button edit-btn" title="Изменить" aria-label="Изменить оценку" data-id="${rating.id}" data-score="${rating.score}" data-review="${encodeURIComponent(reviewText)}"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.13,5.12L18.88,8.87M3,17.25V21H6.75L17.81,9.94L14.06,6.19L3,17.25Z"></path></svg></button>
                        <button class="icon-button delete-btn" title="Удалить" aria-label="Удалить оценку" data-id="${rating.id}"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"></path></svg></button>
                    </div>`;
                trackRatingsList.appendChild(item);
            });
            currentPage++;
        }
        
        trackRatingsControls.innerHTML = '';
        if (data && data.length === PAGE_SIZE) {
            loadMoreButton = document.createElement('button');
            loadMoreButton.textContent = 'Загрузить еще';
            loadMoreButton.className = 'button button-secondary';
            loadMoreButton.addEventListener('click', loadMoreTracks);
            trackRatingsControls.appendChild(loadMoreButton);
        }

        if (currentPage === 1 && (!data || data.length === 0)) {
            trackRatingsList.innerHTML = '<p>Вы еще не ставили оценок трекам.</p>';
        }

        isLoading = false;
    };

    trackRatingsList.addEventListener('click', async (e) => {
        const target = e.target.closest('.delete-btn, .edit-btn');
        if (!target) return;

        target.disabled = true;
        if (target.classList.contains('delete-btn')) {
            if (confirm('Вы уверены, что хотите удалить эту оценку?')) {
                const { error } = await supabaseClient.from('ratings').delete().eq('id', target.dataset.id);
                if (error) alert('Не удалось удалить оценку.');
                else {
                    currentPage = 0;
                    loadMoreTracks();
                }
            }
        }
        if (target.classList.contains('edit-btn')) {
            document.dispatchEvent(new CustomEvent('openEditModal', {
                detail: { id: target.dataset.id, score: target.dataset.score, review: decodeURIComponent(target.dataset.review) }
            }));
        }
        target.disabled = false;
    });

    document.addEventListener('ratingUpdated', () => {
        currentPage = 0;
        loadMoreTracks();
    });

    loadMoreTracks();
}


// КОМПОНЕНТ: ОЦЕНКИ АЛЬБОМОВ
function initializeAlbumRatings(user) {
    const albumRatingsList = document.getElementById('album-ratings-list');
    const albumRatingsControls = document.getElementById('album-ratings-controls');
    if (!albumRatingsList || !albumRatingsControls) return;

    let currentPage = 0;
    const PAGE_SIZE = 15;
    let isLoading = false;
    let loadMoreButton;

    const loadMoreAlbums = async () => {
        if (isLoading) return;
        isLoading = true;
        if(loadMoreButton) loadMoreButton.disabled = true;

        const from = currentPage * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        
        const { data, error } = await supabaseClient
            .from('album_ratings')
            .select(`*, albums(id, title, cover_art_url)`)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .range(from, to);

        if (currentPage === 0) {
            albumRatingsList.innerHTML = '';
        }

        if (error) {
            console.error('Ошибка загрузки оценок альбомов:', error);
            albumRatingsList.innerHTML = '<p>Не удалось загрузить оценки.</p>';
            isLoading = false;
            return;
        }

        if (data && data.length > 0) {
            data.forEach(rating => {
                if (!rating.albums) return;
                const item = document.createElement('div');
                item.className = 'review-item';
                const reviewText = rating.review_text || '';
                const reviewHtml = reviewText ? `<p class="review-item-text">"${reviewText}"</p>` : '';
                const coverUrl = getTransformedImageUrl(rating.albums.cover_art_url, { width: 120, height: 120, resize: 'cover' }) || 'https://via.placeholder.com/60';

                item.innerHTML = `
                    <img src="${coverUrl}" alt="Обложка альбома ${rating.albums.title}" class="review-item-cover" loading="lazy">
                    <div class="review-item-body">
                         <div class="review-item-header">
                            <a href="album.html?id=${rating.albums.id}" class="review-item-title">${rating.albums.title}</a>
                            <span class="review-item-score">Ваша оценка: <strong>${parseFloat(rating.final_score).toFixed(2)}/30</strong></span>
                        </div>
                        ${reviewHtml}
                    </div>
                    <div class="review-item-controls">
                        <button class="icon-button edit-album-btn" title="Изменить" aria-label="Изменить оценку"
                            data-id="${rating.id}"
                            data-rarity="${rating.rarity}"
                            data-integrity="${rating.integrity}"
                            data-depth="${rating.depth}"
                            data-quality="${rating.quality}"
                            data-influence="${rating.influence}"
                            data-review="${encodeURIComponent(reviewText)}">
                            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.13,5.12L18.88,8.87M3,17.25V21H6.75L17.81,9.94L14.06,6.19L3,17.25Z"></path></svg>
                        </button>
                        <button class="icon-button delete-btn" title="Удалить" aria-label="Удалить оценку" data-id="${rating.id}"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"></path></svg></button>
                    </div>`;
                albumRatingsList.appendChild(item);
            });
            currentPage++;
        }
        
        albumRatingsControls.innerHTML = '';
        if (data && data.length === PAGE_SIZE) {
            loadMoreButton = document.createElement('button');
            loadMoreButton.textContent = 'Загрузить еще';
            loadMoreButton.className = 'button button-secondary';
            loadMoreButton.addEventListener('click', loadMoreAlbums);
            albumRatingsControls.appendChild(loadMoreButton);
        }
        
        if (currentPage === 1 && (!data || data.length === 0)) {
            albumRatingsList.innerHTML = '<p>Вы еще не ставили оценок альбомам.</p>';
        }

        isLoading = false;
    };

    albumRatingsList.addEventListener('click', async (e) => {
        const target = e.target.closest('.delete-btn, .edit-album-btn');
        if (!target) return;
        
        target.disabled = true;

        if (target.classList.contains('delete-btn')) {
            if (confirm('Вы уверены, что хотите удалить оценку альбома?')) {
                const { error } = await supabaseClient.from('album_ratings').delete().eq('id', target.dataset.id);
                if (error) alert('Не удалось удалить оценку.');
                else {
                    currentPage = 0;
                    loadMoreAlbums();
                }
            }
        }
        if (target.classList.contains('edit-album-btn')) {
            const detail = { ...target.dataset, review: decodeURIComponent(target.dataset.review) };
            document.dispatchEvent(new CustomEvent('openEditAlbumModal', { detail }));
        }
        target.disabled = false;
    });

    document.addEventListener('albumRatingUpdated', () => {
        currentPage = 0;
        loadMoreAlbums();
    });
    
    loadMoreAlbums();
}

// КОМПОНЕНТ: МОДАЛЬНОЕ ОКНО РЕДАКТИРОВАНИЯ ОЦЕНКИ ТРЕКА
function initializeRatingEditModal() {
    const modalOverlay = document.getElementById('edit-modal-overlay');
    if (!modalOverlay) return;
    const modal = document.getElementById('edit-modal');
    
    const editRatingForm = document.getElementById('edit-rating-form');
    const submitButton = editRatingForm.querySelector('button[type="submit"]');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const editRatingIdInput = document.getElementById('edit-rating-id');
    const editScoreInput = document.getElementById('edit-score-input');
    const editReviewInput = document.getElementById('edit-review-input');
    let cleanupFocusTrap = null;

    const openModal = ({ id, score, review }) => {
        editRatingIdInput.value = id;
        editScoreInput.value = score;
        editReviewInput.value = review;
        modalOverlay.classList.add('is-visible');
        if(cleanupFocusTrap) cleanupFocusTrap();
        cleanupFocusTrap = trapFocus(modal);
    };
    const closeModal = () => {
        modalOverlay.classList.remove('is-visible');
        if(cleanupFocusTrap) cleanupFocusTrap();
    };

    document.addEventListener('openEditModal', (e) => openModal(e.detail));

    editRatingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        submitButton.disabled = true;
        const { error } = await supabaseClient.from('ratings').update({
            score: editScoreInput.value,
            review_text: editReviewInput.value.trim() || null
        }).eq('id', editRatingIdInput.value);

        if (error) {
            alert('Не удалось обновить оценку.');
        } else {
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

// --- НОВАЯ ФУНКЦИЯ ---
// КОМПОНЕНТ: МОДАЛЬНОЕ ОКНО РЕДАКТИРОВАНИЯ ОЦЕНКИ АЛЬБОМА
function initializeAlbumRatingEditModal() {
    const modalOverlay = document.getElementById('edit-album-modal-overlay');
    if (!modalOverlay) return;
    const modal = document.getElementById('edit-album-modal');

    // Элементы формы
    const form = document.getElementById('edit-album-rating-form');
    const ratingIdInput = document.getElementById('edit-album-rating-id');
    const rarityInput = document.getElementById('edit-rarity-input');
    const integrityInput = document.getElementById('edit-integrity-input');
    const depthInput = document.getElementById('edit-depth-input');
    const qualityInput = document.getElementById('edit-quality-input');
    const influenceInput = document.getElementById('edit-influence-input');
    const reviewInput = document.getElementById('edit-album-review-input');
    const submitButton = form.querySelector('button[type="submit"]');
    const cancelButton = document.getElementById('cancel-edit-album-btn');
    
    // Элементы для отображения значений
    const rarityValueSpan = document.getElementById('edit-rarity-value');
    const integrityValueSpan = document.getElementById('edit-integrity-value');
    const depthValueSpan = document.getElementById('edit-depth-value');
    const qualityValueSpan = document.getElementById('edit-quality-value');
    const influenceValueSpan = document.getElementById('edit-influence-value');
    const finalScoreDisplay = document.getElementById('edit-final-score-display');
    let cleanupFocusTrap = null;

    const calculateFinalScore = () => {
        const rarity = parseInt(rarityInput.value);
        const integrity = parseInt(integrityInput.value);
        const depth = parseInt(depthInput.value);
        const quality = parseFloat(qualityInput.value);
        const influence = parseFloat(influenceInput.value);
        const finalScore = (rarity + integrity + depth) * (quality / 100) * influence;
        finalScoreDisplay.textContent = finalScore.toFixed(2);
        finalScoreDisplay.style.color = getScoreColor(finalScore);
    };

    const openModal = (detail) => {
        ratingIdInput.value = detail.id;
        rarityInput.value = detail.rarity;
        integrityInput.value = detail.integrity;
        depthInput.value = detail.depth;
        qualityInput.value = detail.quality;
        influenceInput.value = detail.influence;
        reviewInput.value = detail.review;
        
        rarityValueSpan.textContent = detail.rarity;
        integrityValueSpan.textContent = detail.integrity;
        depthValueSpan.textContent = detail.depth;
        qualityValueSpan.textContent = detail.quality;
        influenceValueSpan.textContent = detail.influence;
        
        calculateFinalScore();
        modalOverlay.classList.add('is-visible');
        if(cleanupFocusTrap) cleanupFocusTrap();
        cleanupFocusTrap = trapFocus(modal);
    };

    const closeModal = () => {
        modalOverlay.classList.remove('is-visible');
        if(cleanupFocusTrap) cleanupFocusTrap();
    };

    document.addEventListener('openEditAlbumModal', (e) => openModal(e.detail));
    
    form.addEventListener('input', calculateFinalScore);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        submitButton.disabled = true;

        const finalScore = parseFloat(finalScoreDisplay.textContent);
        const { error } = await supabaseClient.from('album_ratings').update({
            rarity: parseInt(rarityInput.value),
            integrity: parseInt(integrityInput.value),
            depth: parseInt(depthInput.value),
            quality: parseInt(qualityInput.value),
            influence: parseFloat(influenceInput.value),
            final_score: finalScore,
            review_text: reviewInput.value.trim() || null
        }).eq('id', ratingIdInput.value);
        
        if (error) {
            alert('Не удалось обновить оценку альбома.');
            console.error(error);
        } else {
            closeModal();
            document.dispatchEvent(new Event('albumRatingUpdated'));
        }
        submitButton.disabled = false;
    });

    cancelButton.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });
}


// КОМПОНЕНТ: ДОСТИЖЕНИЯ
function initializeAchievements(user) {
    const achievementsButton = document.getElementById('achievements-button');
    const modalOverlay = document.getElementById('achievements-modal-overlay');
    const modal = document.getElementById('achievements-modal');
    const achievementsList = document.getElementById('achievements-list');
    const closeModalBtn = document.getElementById('close-achievements-btn');
    let cleanupFocusTrap = null;

    if (!achievementsButton || !modalOverlay || !achievementsList || !closeModalBtn) return;

    const openModal = () => {
        modalOverlay.classList.add('is-visible');
        if(cleanupFocusTrap) cleanupFocusTrap();
        cleanupFocusTrap = trapFocus(modal);
        loadAndRenderAchievements();
    };
    const closeModal = () => {
        modalOverlay.classList.remove('is-visible');
        if(cleanupFocusTrap) cleanupFocusTrap();
    };

    const loadAndRenderAchievements = async () => {
        achievementsList.innerHTML = '<p>Загрузка достижений...</p>';
        try {
            const { data: earnedData, error } = await supabaseClient
                .from('user_achievements')
                .select('achievement_id')
                .eq('user_id', user.id);

            if (error) throw error;

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
                        item.className = `achievement-item ${isEarned ? 'is-earned' : ''}`;
                        item.innerHTML = `
                            <div class="achievement-icon" aria-hidden="true">${ach.icon}</div>
                            <div class="achievement-details">
                                <h4>${ach.title}</h4>
                                <p>${ach.description}</p>
                            </div>`;
                        groupContainer.appendChild(item);
                    });
                    achievementsList.appendChild(groupContainer);
                }
            }
        } catch (error) {
            console.error('Ошибка загрузки достижений:', error);
            achievementsList.innerHTML = '<p>Не удалось загрузить данные о достижениях.</p>';
        }
    };

    achievementsButton.addEventListener('click', openModal);
    closeModalBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });
}