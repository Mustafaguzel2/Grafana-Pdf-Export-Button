const fs = require('fs');
const path = require('path');

// Yapılandırma
const OUTPUT_DIR = './output';
const MAX_AGE_HOURS = 72; // 24 saat sonra dosyaları sil
const MAX_AGE_MS = MAX_AGE_HOURS * 60 * 60 * 1000;

function cleanup() {
    console.log('PDF temizleme işlemi başlatılıyor...');
    
    // output klasörünün varlığını kontrol et
    if (!fs.existsSync(OUTPUT_DIR)) {
        console.log('Output klasörü bulunamadı.');
        return;
    }

    const now = Date.now();
    let deletedCount = 0;
    let errorCount = 0;

    // output klasöründeki tüm dosyaları oku
    fs.readdir(OUTPUT_DIR, (err, files) => {
        if (err) {
            console.error('Klasör okuma hatası:', err);
            return;
        }

        files.forEach(file => {
            if (file.endsWith('.pdf')) {
                const filePath = path.join(OUTPUT_DIR, file);
                
                try {
                    const stats = fs.statSync(filePath);
                    const fileAge = now - stats.mtime.getTime();

                    // Dosya belirlenen süreden eski mi kontrol et
                    if (fileAge > MAX_AGE_MS) {
                        fs.unlinkSync(filePath);
                        deletedCount++;
                        console.log(`Silindi: ${file}`);
                    }
                } catch (error) {
                    console.error(`Dosya işleme hatası (${file}):`, error);
                    errorCount++;
                }
            }
        });

        console.log(`\nTemizleme tamamlandı:`);
        console.log(`- Silinen dosya sayısı: ${deletedCount}`);
        console.log(`- Hata sayısı: ${errorCount}`);
    });
}

// Script doğrudan çalıştırıldığında temizliği başlat
if (require.main === module) {
    cleanup();
}

module.exports = cleanup; // Başka yerlerden de kullanılabilmesi için export et 