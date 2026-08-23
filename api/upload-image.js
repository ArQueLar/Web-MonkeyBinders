// api/upload-image.js
// Función serverless de Vercel. Corre en el servidor, nunca en el navegador,
// así que la clave de ImgBB (process.env.IMGBB_API_KEY) nunca se expone al público.

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Método no permitido' });
    }

    try {
        const { image } = req.body; // string en base64, sin el prefijo "data:image/...;base64,"

        if (!image) {
            return res.status(400).json({ success: false, error: 'Falta la imagen' });
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
