// api/upload-image.js
// Función serverless de Vercel. Corre en el servidor, nunca en el navegador,
// así que la clave de ImgBB (process.env.IMGBB_API_KEY) nunca se expone al público.
// Solo acepta imágenes JPEG/PNG/WEBP de tamaño limitado (comprobado por los
// primeros bytes del archivo, no por lo que diga el navegador).

// Vercel limita el cuerpo de una petición a ~4,5 MB; el base64 pesa ~33 % más
// que el archivo, así que 3 MB de imagen ≈ 4 MB de texto.
const MAX_BASE64_LENGTH = 4_000_000;

function detectImageType(buf) {
    if (buf.length > 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'jpeg';
    if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) return 'png';
    if (buf.length > 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
    return null;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Método no permitido' });
    }

    try {
        let { image } = req.body || {}; // base64, con o sin prefijo "data:image/...;base64,"

        if (typeof image !== 'string' || !image) {
            return res.status(400).json({ success: false, error: 'Falta la imagen' });
        }
        image = image.replace(/^data:image\/[a-zA-Z+.-]+;base64,/, '');

        if (image.length > MAX_BASE64_LENGTH) {
            return res.status(413).json({ success: false, error: 'La imagen es demasiado grande (máximo 3 MB)' });
        }
        if (!/^[A-Za-z0-9+/]+={0,2}$/.test(image)) {
            return res.status(400).json({ success: false, error: 'Formato de imagen no válido' });
        }
        if (!detectImageType(Buffer.from(image.slice(0, 64), 'base64'))) {
            return res.status(400).json({ success: false, error: 'Solo se admiten imágenes JPG, PNG o WEBP' });
        }

        const imgbbData = new URLSearchParams();
        imgbbData.append('key', process.env.IMGBB_API_KEY);
        imgbbData.append('image', image);

        const response = await fetch('https://api.imgbb.com/1/upload', {
            method: 'POST',
            body: imgbbData
        });

        const result = await response.json();

        if (!result.success) {
            return res.status(502).json({ success: false, error: 'ImgBB rechazó la imagen' });
        }

        return res.status(200).json({ success: true, url: result.data.url });
    } catch (err) {
        return res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
}
