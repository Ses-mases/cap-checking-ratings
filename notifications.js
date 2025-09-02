async function createReviewNotification(contentType, contentId, reviewerProfile) {
    if (!contentType || !contentId || !reviewerProfile) return;

    try {
        // 1. Определяем, из какой таблицы брать артистов
        const artistLinkTable = contentType === 'album' ? 'album_artists' : 'track_artists';
        const contentIdColumn = contentType === 'album' ? 'album_id' : 'track_id';

        // 2. Получаем ID всех главных артистов релиза
        const { data: artistLinks, error: linkError } = await supabaseClient
            .from(artistLinkTable)
            .select('artist_id')
            .eq(contentIdColumn, contentId)
            .eq('is_main_artist', true); // Уведомляем только основных артистов

        if (linkError) throw linkError;
        if (!artistLinks || artistLinks.length === 0) return;

        const artistIds = artistLinks.map(link => link.artist_id);

        // 3. Находим профили пользователей, связанные с этими артистами
        const { data: artistProfiles, error: profileError } = await supabaseClient
            .from('artists')
            .select('user_id, name')
            .in('id', artistIds)
            .not('user_id', 'is', null); // Выбираем только тех, у кого есть связанный профиль

        if (profileError) throw profileError;
        if (!artistProfiles || artistProfiles.length === 0) return;
        
        // 4. Готовим данные для вставки в таблицу уведомлений
        const notifications = artistProfiles
            .filter(artist => artist.user_id !== reviewerProfile.id) // Артист не должен получать уведомление о своей же рецензии
            .map(artist => {
                const contentName = contentType === 'album' ? 'альбом' : 'трек';
                return {
                    recipient_user_id: artist.user_id,
                    creator_user_id: reviewerProfile.id,
                    type: `new_${contentType}_review`,
                    content: `Пользователь ${reviewerProfile.username} оставил(а) рецензию на ваш ${contentName} «${artist.name}».`,
                    link_url: `${contentType}.html?id=${contentId}`
                };
            });

        if (notifications.length === 0) return;

        // 5. Вставляем уведомления в базу
        const { error: insertError } = await supabaseClient
            .from('notifications')
            .insert(notifications);

        if (insertError) throw insertError;

        console.log(`Успешно создано ${notifications.length} уведомлений.`);

    } catch (error) {
        console.error('Ошибка при создании уведомления:', error);
    }
}