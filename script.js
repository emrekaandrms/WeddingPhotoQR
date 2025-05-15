// Google Apps Script Web Uygulaması URL'nizi buraya yapıştırın
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbx_aeD4tk39cLl4CBEQI2uKuKv-SMb2fEp7uPxsKv_h634lXC7wfNpHw3jeRuX5jATD/exec';

const uploadButton = document.getElementById('uploadButton');
const fileInput = document.getElementById('fileInput');
const uploadStatusDiv = document.getElementById('uploadStatus');
const successMessageDiv = document.getElementById('successMessage');
const errorMessageDiv = document.getElementById('errorMessage');
const errorDetailP = document.getElementById('errorDetail');

uploadButton.addEventListener('click', () => {
    fileInput.click(); // Gizli dosya girişini tetikle
});

fileInput.addEventListener('change', (event) => {
    const files = event.target.files;
    if (files.length > 0) {
        uploadButton.disabled = true;
        successMessageDiv.style.display = 'none';
        errorMessageDiv.style.display = 'none';
        uploadStatusDiv.innerHTML = ''; // Önceki durumları temizle
        
        // Google Drive'a aynı anda çok fazla istek gitmemesi için dosyaları sırayla yükle
        uploadFilesSequentially(Array.from(files));
    }
});

async function uploadFilesSequentially(files) {
    let totalFiles = files.length;
    let uploadedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < totalFiles; i++) {
        const file = files[i];
        uploadStatusDiv.innerHTML = `
            <p>${i + 1}/${totalFiles} dosya yükleniyor: ${file.name}</p>
            <div class="progress-bar-container">
                <div class="progress-bar" id="progressBar-${i}" style="width: 0%;">0%</div>
            </div>
        `;
        
        const progressBar = document.getElementById(`progressBar-${i}`);

        try {
            await uploadFile(file, (progress) => {
                progressBar.style.width = progress + '%';
                progressBar.textContent = progress + '%';
            });
            uploadedCount++;
            progressBar.style.width = '100%';
            progressBar.textContent = '100% (Tamamlandı)';
            progressBar.style.backgroundColor = '#28a745'; // Yeşil renk
        } catch (error) {
            errorCount++;
            progressBar.style.width = '100%';
            progressBar.textContent = 'Hata!';
            progressBar.style.backgroundColor = '#dc3545'; // Kırmızı renk
            console.error(`Dosya yükleme hatası (${file.name}):`, error);
            // Hata detayını gösterebilirsiniz, ama çok teknik olabilir.
            // errorDetailP.textContent = `Dosya: ${file.name} - Hata: ${error.message || error}`;
        }
    }

    uploadButton.disabled = false;
    fileInput.value = ''; // Dosya seçimini sıfırla

    if (uploadedCount > 0 && errorCount === 0) {
        successMessageDiv.style.display = 'block';
        errorMessageDiv.style.display = 'none';
        uploadStatusDiv.innerHTML = `<p>${uploadedCount} dosya başarıyla yüklendi.</p>`;
    } else if (uploadedCount > 0 && errorCount > 0) {
        successMessageDiv.style.display = 'block';
        errorMessageDiv.style.display = 'block';
        errorDetailP.textContent = `${errorCount} dosya yüklenirken hata oluştu. Lütfen kontrol edin.`;
        uploadStatusDiv.innerHTML = `<p>${uploadedCount} dosya yüklendi, ${errorCount} dosyada hata oluştu.</p>`;
    } else if (errorCount > 0) {
        errorMessageDiv.style.display = 'block';
        successMessageDiv.style.display = 'none';
        errorDetailP.textContent = `Tüm dosyalar (${errorCount} adet) yüklenirken hata oluştu.`;
        uploadStatusDiv.innerHTML = '';
    }
}


function uploadFile(file, onProgress) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const fileData = e.target.result; // Bu base64 data olacak
            const payload = {
                fileName: file.name,
                mimeType: file.type,
                fileData: fileData // base64 string
            };

            // Google Apps Script'e göndermek için fetch kullanıyoruz
            // Ancak fetch API'si doğrudan yükleme ilerlemesi (upload progress) sağlamaz.
            // XMLHttpRequest kullanmak daha iyi olurdu, ama basitlik için fetch ile devam edelim.
            // Gerçek bir progress bar için XHR gerekir. Şimdilik anlık bir geçiş yapalım.
            
            onProgress(50); // Sahte ilerleme

            fetch(GAS_WEB_APP_URL, {
                method: 'POST',
                body: JSON.stringify(payload), // JSON olarak gönderiyoruz
                headers: {
                    'Content-Type': 'application/json' // GAS tarafında bunu parse edeceğiz
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    onProgress(100);
                    resolve(data);
                } else {
                    console.error('Apps Script Hata:', data.message);
                    reject(new Error(data.message || 'Bilinmeyen sunucu hatası'));
                }
            })
            .catch(error => {
                console.error('Ağ veya fetch hatası:', error);
                reject(error);
            });
        };
        reader.onerror = (error) => {
            console.error('Dosya okuma hatası:', error);
            reject(error);
        };
        reader.readAsDataURL(file); // Dosyayı base64 olarak oku
    });
}

// NOT: Yukarıdaki `uploadFile` fonksiyonu `fetch` kullanıyor ve gerçek yükleme ilerlemesi
// göstermiyor. Gerçek zamanlı bir progress bar için XMLHttpRequest (XHR) kullanmak daha uygundur.
// Eğer XHR ile yapmak isterseniz, `uploadFile` fonksiyonunu şöyle değiştirebilirsiniz:
/*
function uploadFile(file, onProgress) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const fileData = e.target.result; // base64 data

            const xhr = new XMLHttpRequest();
            xhr.open("POST", GAS_WEB_APP_URL, true);
            // Google Apps Script'e JSON yerine doğrudan URL encoded form data göndermek
            // bazen daha stabil çalışır, özellikle büyük dosyalar için.
            // Ancak Apps Script tarafındaki doPost'u ona göre ayarlamak gerekir.
            // Şimdilik base64 ve JSON ile devam edelim.
            // Eğer Apps Script'e FormData göndermek isterseniz,
            // GAS tarafında `e.parameter.fileData` yerine `e.postData.contents` veya
            // `Utilities.newBlob(e.postData.getBytes(), e.parameter.mimeType, e.parameter.fileName)`
            // gibi bir yapı kullanmanız gerekebilir.

            // Bizim Apps Script'imiz JSON beklediği için JSON gönderiyoruz:
            const payload = {
                fileName: file.name,
                mimeType: file.type,
                fileData: fileData
            };
            
            xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8"); // Gönderilen veri tipi

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percentComplete = Math.round((event.loaded / event.total) * 100);
                    onProgress(percentComplete);
                }
            };

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        if (response.status === 'success') {
                            onProgress(100); // Yükleme bittiğinde
                            resolve(response);
                        } else {
                            reject(new Error(response.message || 'Sunucu hatası (JSON)'));
                        }
                    } catch (parseError) {
                        reject(new Error('Sunucu yanıtı parse edilemedi: ' + parseError.message));
                    }
                } else {
                    reject(new Error(`Sunucu hatası: ${xhr.status} ${xhr.statusText}`));
                }
            };

            xhr.onerror = () => {
                reject(new Error('Ağ hatası veya sunucuya ulaşılamadı.'));
            };

            xhr.send(JSON.stringify(payload));
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
}
*/