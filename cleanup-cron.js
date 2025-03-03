const cron = require('node-cron');
const cleanup = require('./cleanup');

// Her gün gece yarısı çalıştır (00:00)
cron.schedule('0 0 * * *', () => {
    console.log('Zamanlanmış temizlik başlatılıyor...');
    cleanup();
}); 