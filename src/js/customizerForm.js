/* ==========================================================================
   CUSTOMIZER FORM — formulario de personalización (tienda.html):
   subida de imagen vía /api/upload-image y envío vía Web3Forms
   ========================================================================== */

import { showToast } from './toast.js';

export function initCustomizerForm() {
    const customizerForm = document.getElementById('customizer-form');
    if (!customizerForm) return;

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const DEFAULT_UPLOAD_LABEL = '📎 Haz clic para subir una imagen (JPG, PNG · máx. 10MB)';
    const imageInput = document.getElementById('customizer-image-input');
    const fileUploadBox = document.getElementById('file-upload-box');
    const fileUploadLabel = document.getElementById('file-upload-label');
    const fileErrorText = document.getElementById('file-error-text');

    if (imageInput) {
        imageInput.addEventListener('change', () => {
            const file = imageInput.files[0];
            fileErrorText.style.display = 'none';

            if (!file) {
                fileUploadBox.classList.remove('has-file');
                fileUploadLabel.textContent = DEFAULT_UPLOAD_LABEL;
                return;
            }

            if (file.size > MAX_FILE_SIZE) {
                fileErrorText.textContent = 'La imagen supera los 10MB. Elige un archivo más ligero.';
                fileErrorText.style.display = 'block';
                imageInput.value = '';
                fileUploadBox.classList.remove('has-file');
                fileUploadLabel.textContent = DEFAULT_UPLOAD_LABEL;
                return;
            }

            fileUploadBox.classList.add('has-file');
            fileUploadLabel.textContent = `✓ ${file.name}`;
        });
    }

    // Selector de color con muestras (swatches)
    const colorSwatchBtns = document.querySelectorAll('#color-swatch-grid .color-swatch-btn');
    const colorBinderInput = document.getElementById('color-binder-value');
    const colorErrorText = document.getElementById('color-error-text');
    colorSwatchBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            colorSwatchBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (colorBinderInput) colorBinderInput.value = btn.dataset.color;
            if (colorErrorText) colorErrorText.style.display = 'none';
        });
    });

    // Sube la imagen a través de nuestra función serverless (/api/upload-image),
    // que es quien habla con ImgBB. La clave de ImgBB nunca llega al navegador.
    async function uploadImage(file) {
        const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
            reader.readAsDataURL(file);
        });

        const response = await fetch('/api/upload-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64 })
        });
        const result = await response.json();
        if (!result.success) throw new Error('Error al subir la imagen');
        return result.url;
    }

    customizerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('customizer-submit-btn');
        const statusEl = document.getElementById('customizer-form-status');
        const accessKey = customizerForm.querySelector('input[name="access_key"]').value;
        const file = imageInput ? imageInput.files[0] : null;

        if (!accessKey || accessKey === 'TU_ACCESS_KEY_DE_WEB3FORMS') {
            statusEl.textContent = 'Falta configurar la clave de Web3Forms en el formulario.';
            statusEl.className = 'form-status-error';
            return;
        }

        if (colorBinderInput && !colorBinderInput.value) {
            if (colorErrorText) {
                colorErrorText.textContent = 'Elige un color para el binder.';
                colorErrorText.style.display = 'block';
            }
            document.getElementById('color-swatch-grid')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        submitBtn.disabled = true;
        statusEl.textContent = '';
        statusEl.className = '';

        try {
            const formData = new FormData(customizerForm);
            formData.delete('attachment'); // No enviamos el archivo binario a Web3Forms (requiere plan de pago)

            if (file) {
                submitBtn.textContent = 'SUBIENDO IMAGEN...';
                const imageUrl = await uploadImage(file);
                formData.append('Imagen del diseño', imageUrl);
            } else {
                formData.append('Imagen del diseño', 'No se adjuntó ninguna imagen');
            }

            submitBtn.textContent = 'ENVIANDO...';
            const response = await fetch('https://api.web3forms.com/submit', {
                method: 'POST',
                headers: { 'Accept': 'application/json' },
                body: formData
            });
            const result = await response.json();

            if (result.success) {
                statusEl.textContent = '✓ ¡Solicitud enviada! Te contactaremos pronto por email.';
                statusEl.className = 'form-status-success';
                showToast('✓ ¡Solicitud de personalización enviada!');
                customizerForm.reset();
                if (fileUploadBox) fileUploadBox.classList.remove('has-file');
                if (fileUploadLabel) fileUploadLabel.textContent = DEFAULT_UPLOAD_LABEL;
                colorSwatchBtns.forEach(b => b.classList.remove('active'));
                if (colorBinderInput) colorBinderInput.value = '';
            } else {
                statusEl.textContent = 'Hubo un problema al enviar. Inténtalo de nuevo.';
                statusEl.className = 'form-status-error';
            }
        } catch (err) {
            statusEl.textContent = err.message === 'Error al subir la imagen'
                ? 'No se pudo subir la imagen. Inténtalo de nuevo o continúa sin adjuntarla.'
                : 'Error de conexión. Inténtalo de nuevo más tarde.';
            statusEl.className = 'form-status-error';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'ENVIAR SOLICITUD';
        }
    });
}
