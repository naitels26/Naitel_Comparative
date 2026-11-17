export default function handler(req,res) { res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'contact_not_configured'})); }
