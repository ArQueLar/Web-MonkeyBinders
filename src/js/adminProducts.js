/* ==========================================================================
   ADMIN · ARTÍCULOS — alta, edición y archivado de artículos (se guardan en Odoo)
   ========================================================================== */

import { escapeHtml } from './utils.js';
import { showToast } from './toast.js';

let state = { products: [], categories: [], showArchived: false, editing: null, pendingFiles: [] };

async function api(method, body) {
    const r = await fetch('/api/admin/products', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'POST' ? JSON.stringify(body) : undefined
    });
    return r.json().catch(() => ({ success: false, error: 'Respuesta no válida del servidor' }));
}

export async function initAdminProducts(tab) {
    tab.innerHTML = `<p style="text-align:center; color:var(--text-muted); padding:30px 0;">Cargando artículos...</p>`;
    const data = await api('GET');
    if (!data.success) {
        tab.innerHTML = `<p style="text-align:center; color:var(--text-muted); padding:30px 0;">No se pudieron cargar los artículos.</p>`;
        return;
    }
    state.products = data.products;
    state.categories = data.categories;
    state.editing = null;
    renderList(tab);
}

function badge(p) {
    if (!p.active) return `<span style="background:var(--text-muted); color:#fff; padding:2px 8px; border-radius:20px; font-size:10.5px; font-weight:800;">ARCHIVADO</span>`;
    if (p.published) return `<span style="background:var(--accent-jungle); color:#fff; padding:2px 8px; border-radius:20px; font-size:10.5px; font-weight:800;">PUBLICADO</span>`;
    return `<span style="background:#e8a33d; color:#fff; padding:2px 8px; border-radius:20px; font-size:10.5px; font-weight:800;">BORRADOR</span>`;
}

function renderList(tab) {
    const rows = state.products.filter(p => state.showArchived || p.active);
    tab.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:14px;">
            <button class="btn-primary" id="ap-new" style="padding:10px 18px; font-size:12px;">+ NUEVO ARTÍCULO</button>
            <label style="display:flex; align-items:center; gap:6px; font-size:12.5px; cursor:pointer;">
                <input type="checkbox" id="ap-show-archived" ${state.showArchived ? 'checked' : ''}> Mostrar archivados
            </label>
        </div>
        <p style="font-size:12px; color:var(--text-muted); margin:0 0 14px;">Los artículos nuevos se crean como <strong>borrador</strong>: revísalos y pulsa PUBLICAR. Los cambios pueden tardar hasta 5 minutos en verse en la tienda.</p>
        <div id="ap-rows">
            ${rows.length === 0 ? '<p style="text-align:center; color:var(--text-muted); padding:30px 0;">No hay artículos.</p>' : rows.map(p => `
                <div style="display:flex; gap:12px; align-items:center; border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:10px 12px; margin-bottom:10px; flex-wrap:wrap; ${p.active ? '' : 'opacity:0.6;'}">
                    <img src="${escapeHtml(p.imageUrl)}" alt="" loading="lazy" style="width:52px; height:52px; object-fit:contain; border-radius:6px; background:var(--bg-card);">
                    <div style="flex:1; min-width:160px;">
                        <div style="font-weight:800; font-size:13.5px;">${escapeHtml(p.name)}</div>
                        <div style="font-size:12px; color:var(--text-secondary);">${p.priceWithTax.toFixed(2)} € (IVA incl.) · Stock: ${escapeHtml(p.stock)}</div>
                    </div>
                    ${badge(p)}
                    <div style="display:flex; gap:6px; flex-wrap:wrap;">
                        <button class="btn-secondary ap-edit" data-id="${p.id}" style="padding:6px 12px; font-size:11px;">EDITAR</button>
                        ${p.active ? `<button class="btn-secondary ap-toggle" data-id="${p.id}" data-pub="${p.published ? '0' : '1'}" style="padding:6px 12px; font-size:11px;">${p.published ? 'OCULTAR' : 'PUBLICAR'}</button>` : ''}
                        ${p.isService ? '' : (p.active
                            ? `<button class="btn-secondary ap-archive" data-id="${p.id}" style="padding:6px 12px; font-size:11px; color:var(--accent-error);">ARCHIVAR</button>`
                            : `<button class="btn-secondary ap-restore" data-id="${p.id}" style="padding:6px 12px; font-size:11px;">RESTAURAR</button>`)}
                    </div>
                </div>`).join('')}
        </div>
    `;

    tab.querySelector('#ap-new').addEventListener('click', () => openForm(tab, null));
    tab.querySelector('#ap-show-archived').addEventListener('change', e => { state.showArchived = e.target.checked; renderList(tab); });
    tab.querySelectorAll('.ap-edit').forEach(b => b.addEventListener('click', () => openForm(tab, state.products.find(p => p.id === Number(b.dataset.id)))));
    tab.querySelectorAll('.ap-toggle').forEach(b => b.addEventListener('click', () => act(tab, { action: 'update', id: Number(b.dataset.id), published: b.dataset.pub === '1' }, b.dataset.pub === '1' ? '✓ Artículo publicado' : '✓ Artículo oculto')));
    tab.querySelectorAll('.ap-archive').forEach(b => b.addEventListener('click', () => {
        const p = state.products.find(x => x.id === Number(b.dataset.id));
        if (confirm(`¿Archivar "${p.name}"? Dejará de verse en la tienda, pero se puede restaurar.`)) act(tab, { action: 'archive', id: p.id }, '✓ Artículo archivado');
    }));
    tab.querySelectorAll('.ap-restore').forEach(b => b.addEventListener('click', () => act(tab, { action: 'restore', id: Number(b.dataset.id) }, '✓ Artículo restaurado (queda como borrador)')));
}

async function act(tab, body, okMessage) {
    const r = await api('POST', body);
    if (!r.success) { showToast(`⚠ ${r.error || 'No se pudo completar'}`); return; }
    showToast(okMessage);
    await initAdminProducts(tab);
}

// Reduce la foto a máx. 1600 px y la convierte a JPEG, para no pasar el límite de tamaño de Vercel
function resizeImage(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1]);
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
        img.src = url;
    });
}

function openForm(tab, product) {
    const p = product || { name: '', priceWithTax: '', description: '', categoryIds: [], hasXL: false, engravingOptions: [], stock: '', extraImages: [] };
    state.editing = product;
    const field = 'width:100%;';
    tab.innerHTML = `
        <button class="btn-secondary" id="ap-back" style="padding:6px 14px; font-size:11px; margin-bottom:14px;">← VOLVER A LA LISTA</button>
        <h3 style="font-size:16px; margin:0 0 14px;">${product ? 'EDITAR ARTÍCULO' : 'NUEVO ARTÍCULO'}</h3>
        <form id="ap-form" style="display:flex; flex-direction:column; gap:12px; max-width:560px;">
            <label style="font-size:12px; font-weight:700;">Nombre
                <input type="text" id="ap-name" class="form-input" style="${field}" maxlength="120" required value="${escapeHtml(p.name)}"></label>
            <label style="font-size:12px; font-weight:700;">Precio con IVA (€)
                <input type="number" id="ap-price" class="form-input" style="${field}" min="0" max="10000" step="0.01" required value="${escapeHtml(p.priceWithTax)}"></label>
            <label style="font-size:12px; font-weight:700;">Descripción
                <textarea id="ap-desc" class="form-input" style="${field} min-height:100px;" maxlength="5000">${escapeHtml(p.description)}</textarea></label>

            <div style="font-size:12px; font-weight:700;">Categorías
                <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:6px; font-weight:400;">
                    ${state.categories.map(c => `<label style="display:flex; align-items:center; gap:5px; border:1px solid var(--border-color); border-radius:20px; padding:4px 10px; cursor:pointer;">
                        <input type="checkbox" class="ap-cat" value="${c.id}" ${p.categoryIds.includes(c.id) ? 'checked' : ''}> ${escapeHtml(c.name)}</label>`).join('')}
                </div>
            </div>

            <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;">
                <input type="checkbox" id="ap-xl" ${p.hasXL ? 'checked' : ''}> Ofrecer tamaño 4x3 XL (+15 €, bajo pedido)</label>
            <label style="font-size:12px; font-weight:700;">Opciones de grabado (separadas por comas, opcional)
                <input type="text" id="ap-eng" class="form-input" style="${field}" placeholder="Logo Pikachu, Logo Aleatorio" value="${escapeHtml(p.engravingOptions.join(', '))}"></label>
            <label style="font-size:12px; font-weight:700;">Stock ${product ? '(déjalo igual si no cambia)' : 'inicial (opcional)'}
                <input type="number" id="ap-stock" class="form-input" style="${field}" min="0" max="100000" step="1" value="${escapeHtml(product ? p.stock : '')}"></label>

            <div style="font-size:12px; font-weight:700;">Fotos
                ${product && p.extraImages.length ? `<div style="display:flex; gap:8px; flex-wrap:wrap; margin:8px 0;">${p.extraImages.map(i => `
                    <div style="position:relative;"><img src="${escapeHtml(i.url)}" alt="" style="width:64px; height:64px; object-fit:contain; border:1px solid var(--border-color); border-radius:6px;">
                    <button type="button" class="ap-del-img" data-id="${i.id}" title="Quitar foto" style="position:absolute; top:-6px; right:-6px; width:20px; height:20px; border-radius:50%; border:none; background:var(--accent-error); color:#fff; cursor:pointer; font-size:11px;">✕</button></div>`).join('')}</div>` : ''}
                <input type="file" id="ap-files" accept="image/jpeg,image/png,image/webp" multiple style="display:block; margin-top:6px; font-weight:400;">
                <div style="font-weight:400; color:var(--text-muted); margin-top:4px;">La primera foto de un artículo nuevo será la principal. Se reducen automáticamente.</div>
            </div>

            <button type="submit" class="btn-primary" id="ap-save" style="padding:12px 22px; font-size:12px; width:fit-content;">${product ? 'GUARDAR CAMBIOS' : 'CREAR COMO BORRADOR'}</button>
            <div id="ap-status" style="font-size:12.5px;"></div>
        </form>
    `;

    tab.querySelector('#ap-back').addEventListener('click', () => renderList(tab));
    tab.querySelectorAll('.ap-del-img').forEach(b => b.addEventListener('click', async () => {
        if (!confirm('¿Quitar esta foto?')) return;
        const r = await api('POST', { action: 'delete-image', imageId: Number(b.dataset.id) });
        if (r.success) { b.parentElement.remove(); showToast('✓ Foto quitada'); } else showToast(`⚠ ${r.error || 'No se pudo quitar'}`);
    }));

    tab.querySelector('#ap-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const status = tab.querySelector('#ap-status');
        const saveBtn = tab.querySelector('#ap-save');
        const setStatus = (t, err) => { status.textContent = t; status.style.color = err ? 'var(--accent-error)' : 'var(--text-muted)'; };
        saveBtn.disabled = true;
        setStatus('Guardando en Odoo...');

        const payload = {
            name: tab.querySelector('#ap-name').value,
            price: tab.querySelector('#ap-price').value,
            description: tab.querySelector('#ap-desc').value,
            categoryIds: [...tab.querySelectorAll('.ap-cat:checked')].map(c => Number(c.value)),
            hasXL: tab.querySelector('#ap-xl').checked,
            engravingOptions: tab.querySelector('#ap-eng').value.split(',').map(s => s.trim()).filter(Boolean),
            stock: tab.querySelector('#ap-stock').value
        };

        try {
            const r = await api('POST', product ? { action: 'update', id: product.id, ...payload } : { action: 'create', ...payload });
            if (!r.success) throw new Error(r.error || 'No se pudo guardar');
            const id = product ? product.id : r.id;
            const warnings = [...(r.warnings || [])];

            const files = [...tab.querySelector('#ap-files').files];
            for (let i = 0; i < files.length; i++) {
                setStatus(`Subiendo foto ${i + 1} de ${files.length}...`);
                try {
                    const image = await resizeImage(files[i]);
                    const up = await api('POST', { action: 'add-image', id, image });
                    if (!up.success) warnings.push(`Foto ${i + 1}: ${up.error}`);
                } catch (err) { warnings.push(`Foto ${i + 1}: ${err.message}`); }
            }

            showToast(warnings.length ? '✓ Guardado, con avisos' : '✓ Artículo guardado');
            await initAdminProducts(tab);
            if (warnings.length) {
                const note = document.createElement('p');
                note.style.cssText = 'font-size:12.5px; color:var(--accent-error); margin-top:12px;';
                note.textContent = '⚠ ' + warnings.join(' · ');
                tab.prepend(note);
            }
        } catch (err) {
            setStatus(`⚠ ${err.message}`, true);
            saveBtn.disabled = false;
        }
    });
}
