// api/admin/me.js
import { getAdminSessionFromRequest } from '../_lib/auth.js';

export default async function handler(req, res) {
    const session = getAdminSessionFromRequest(req);
    return res.status(200).json({ success: true, loggedIn: Boolean(session) });
}
