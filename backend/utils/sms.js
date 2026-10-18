const parseSms = (sender, text) => {
    const s = String(sender || '');
    const t = String(text || '');

    if (!/received/i.test(t)) return null;

    let method = null;
    if (/bkash/i.test(s) || /bkash/i.test(t)) method = 'bkash';
    else if (/rocket|16216|dbbl/i.test(s) || /rocket/i.test(t)) method = 'rocket';
    if (!method) return null;

    const trx = t.match(/(?:TrxID|Trx\s*ID|TxnID|Txn\s*ID|Transaction\s*ID)\s*[:\-]?\s*([A-Z0-9]{6,20})\b/i);

    // FIX: "received Tk 500" ar "Tk 500 received" dui rokom lekha-i dhore
    const CUR = '(?:Tk\\.?|BDT|৳)\\s*';
    const NUM = '([\\d,]+(?:\\.\\d{1,2})?)';
    const amt =
        t.match(new RegExp('received\\s*(?:' + CUR + ')?' + NUM, 'i')) ||
        t.match(new RegExp(CUR + NUM + '\\s*received', 'i'));
    if (!trx || !amt) return null;

    // je number theke taka eshechhe (SMS e "from 01XXXXXXXXX" thake). na pele null
    const from = t.match(/from\s*(?:A\/C:?\s*)?(?:\+?88)?(01\d{9})/i);

    return {
        method,
        fromNumber: from ? from[1] : null,
        trxId: trx[1].toUpperCase(),
        amount: Number(amt[1].replace(/,/g, ''))
    };
};

module.exports = { parseSms };