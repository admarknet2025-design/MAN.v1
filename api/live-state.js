/* GET /api/live-state — what phones (?view=state, the default), the projector (?view=screen) and the card maker (?view=filter) read.
   Public. Cached by the edge for one second, so a room of phones polling every two seconds costs Redis about one read per second. */
'use strict';

const live = require('./_live');

module.exports = async function handler(req, res) {
  const view = (req.query && req.query.view) || 'state';
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (!live.store.configured()) { res.setHeader('Cache-Control', 'no-store'); return res.status(503).json({ error: 'not configured' }); }
  try {
    let body;
    if (view === 'screen') body = await live.screenState();
    else if (view === 'sessions') body = await live.sessionsState();
    else if (view === 'filter') {
      /* the same list the server uses, so a takeaway card is checked before it is drawn */
      const l = await live.blocklist();
      res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
      return res.status(200).json({ words: l.words });
    } else body = await live.publicState();
    res.setHeader('Cache-Control', 'public, s-maxage=1, stale-while-revalidate=2');
    return res.status(200).json(body);
  } catch (e) {
    console.error('live state error', e && e.message);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: 'unavailable' });
  }
};
