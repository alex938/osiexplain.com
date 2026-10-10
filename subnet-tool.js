// ============================================================================
// Layer 3 subnet calculator and practice mode.
// Everything is done with unsigned 32-bit integers (`>>> 0` keeps JS bitwise
// results unsigned). Progressive enhancement: the section is inert without JS.
// ============================================================================
(function () {
    'use strict';

    var root = document.querySelector('[data-subnet-tool]');
    if (!root) return;

    // ---- Address maths ------------------------------------------------------
    function parseIp(text) {
        var parts = String(text).trim().split('.');
        if (parts.length !== 4) return null;
        var value = 0;
        for (var i = 0; i < 4; i++) {
            if (!/^\d{1,3}$/.test(parts[i])) return null;
            var octet = Number(parts[i]);
            if (octet > 255) return null;
            value = value * 256 + octet;
        }
        return value >>> 0;
    }

    function toIp(value) {
        return [value >>> 24, (value >>> 16) & 255, (value >>> 8) & 255, value & 255].join('.');
    }

    function octets(value) {
        return [value >>> 24, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];
    }

    function maskFromPrefix(prefix) {
        return prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;
    }

    function prefixFromMask(mask) {
        // A valid mask is a run of 1s followed by a run of 0s.
        var inverted = (~mask) >>> 0;
        if ((inverted & (inverted + 1)) !== 0) return null;
        var prefix = 0;
        while (prefix < 32 && (mask & (0x80000000 >>> prefix))) prefix++;
        return prefix;
    }

    // Accepts "a.b.c.d/n", "a.b.c.d n", "a.b.c.d/m.m.m.m" and "a.b.c.d m.m.m.m".
    function parseInput(text) {
        var match = String(text).trim().match(/^(\S+?)\s*(?:\/\s*|\s+)(\S+)$/);
        if (!match) {
            return { error: 'Add a prefix length after the address, for example 192.168.1.10/24.' };
        }
        var address = parseIp(match[1]);
        if (address === null) {
            return { error: '“' + match[1] + '” is not a valid IPv4 address. Use four numbers from 0 to 255 separated by dots.' };
        }
        var prefix;
        if (/^\d{1,2}$/.test(match[2])) {
            prefix = Number(match[2]);
            if (prefix > 32) return { error: 'An IPv4 prefix length runs from /0 to /32.' };
        } else {
            var mask = parseIp(match[2]);
            if (mask === null) return { error: '“' + match[2] + '” is neither a prefix length nor a dotted subnet mask.' };
            prefix = prefixFromMask(mask);
            if (prefix === null) {
                return { error: toIp(mask) + ' is not a valid subnet mask: the 1 bits must be contiguous from the left.' };
            }
        }
        return { address: address, prefix: prefix };
    }

    function analyse(address, prefix) {
        var mask = maskFromPrefix(prefix);
        var network = (address & mask) >>> 0;
        var broadcast = (network | (~mask >>> 0)) >>> 0;
        var total = Math.pow(2, 32 - prefix);
        var r = {
            address: address,
            prefix: prefix,
            mask: mask,
            wildcard: (~mask) >>> 0,
            network: network,
            broadcast: broadcast,
            total: total
        };
        if (prefix === 32) {
            r.first = r.last = network;
            r.usable = 1;
        } else if (prefix === 31) {
            r.first = network;
            r.last = broadcast;
            r.usable = 2;
        } else {
            r.first = network + 1;
            r.last = broadcast - 1;
            r.usable = total - 2;
        }
        return r;
    }

    function inRange(address, base, prefix) {
        return ((address & maskFromPrefix(prefix)) >>> 0) === (parseIp(base) >>> 0);
    }

    function addressType(address) {
        if (inRange(address, '10.0.0.0', 8) || inRange(address, '172.16.0.0', 12) || inRange(address, '192.168.0.0', 16)) {
            return 'Private (RFC 1918) — not routed on the public internet';
        }
        if (inRange(address, '127.0.0.0', 8)) return 'Loopback — never leaves the host';
        if (inRange(address, '169.254.0.0', 16)) return 'Link-local (APIPA) — usually means DHCP failed';
        if (inRange(address, '100.64.0.0', 10)) return 'Shared address space (carrier-grade NAT, RFC 6598)';
        if (inRange(address, '0.0.0.0', 8)) return '“This network” — only valid as a source during bootstrapping';
        if (inRange(address, '224.0.0.0', 4)) return 'Multicast';
        if (inRange(address, '240.0.0.0', 4)) return 'Reserved';
        if (inRange(address, '192.0.2.0', 24) || inRange(address, '198.51.100.0', 24) || inRange(address, '203.0.113.0', 24)) {
            return 'Documentation range (RFC 5737) — reserved for examples';
        }
        return 'Public';
    }

    function legacyClass(address) {
        var first = address >>> 24;
        if (first < 128) return 'A';
        if (first < 192) return 'B';
        if (first < 224) return 'C';
        if (first < 240) return 'D (multicast)';
        return 'E (reserved)';
    }

    function formatNumber(n) {
        return n.toLocaleString('en-GB');
    }

    function escapeHtml(text) {
        return String(text).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    // Binary with network bits and host bits in separate spans, plus a visible
    // divider at the prefix boundary so the split does not rely on colour alone.
    function binaryHtml(value, prefix) {
        var bits = '';
        for (var i = 0; i < 32; i++) bits += (value >>> (31 - i)) & 1;
        var html = '';
        for (var o = 0; o < 4; o++) {
            // Each octet stays on one line; narrow screens may wrap between octets.
            html += '<span class="bits-octet">';
            for (var b = 0; b < 8; b++) {
                var index = o * 8 + b;
                if (index === prefix && prefix !== 0 && prefix !== 32) html += '<span class="bits-split" aria-hidden="true">|</span>';
                html += '<span class="' + (index < prefix ? 'bits-net' : 'bits-host') + '">' + bits[index] + '</span>';
            }
            if (o < 3) html += '<span class="bits-dot">.</span>';
            html += '</span> ';
        }
        return html;
    }

    // The "interesting octet" / block-size method taught for Network+ and CCNA.
    function workingHtml(r) {
        var maskOctets = octets(r.mask);
        var addrOctets = octets(r.address);
        var ordinal = ['1st', '2nd', '3rd', '4th'];

        if (r.prefix === 32) {
            return '<p>A /32 has no host bits at all: it identifies exactly one address. You see it in routing tables as a host route and on loopback interfaces.</p>';
        }
        if (r.prefix === 31) {
            return '<p>A /31 leaves a single host bit, so the subnet holds two addresses. Under RFC 3021, point-to-point links use both of them as hosts, with no network or broadcast address. Most exam questions assume the traditional rule instead, which gives zero usable hosts.</p>';
        }
        if (r.prefix % 8 === 0) {
            var whole = r.prefix / 8;
            return '<p>/' + r.prefix + ' lands exactly on an octet boundary, so the first ' + whole +
                ' octet' + (whole === 1 ? ' is' : 's are') + ' the network and the rest are host bits.</p>' +
                '<ol>' +
                '<li>Network address: keep the network octets and set every host octet to 0 → <code>' + toIp(r.network) + '</code></li>' +
                '<li>Broadcast address: set every host octet to 255 → <code>' + toIp(r.broadcast) + '</code></li>' +
                '<li>Usable hosts: 2<sup>' + (32 - r.prefix) + '</sup> − 2 = ' + formatNumber(r.usable) + '</li>' +
                '</ol>';
        }

        var i = Math.floor(r.prefix / 8);
        var block = 256 - maskOctets[i];
        var start = Math.floor(addrOctets[i] / block) * block;
        var starts = [];
        for (var s = 0; s < 256 && starts.length < 5; s += block) starts.push(s);
        var startsText = starts.join(', ') + (256 / block > starts.length ? '…' : '.');

        return '<ol>' +
            '<li>/' + r.prefix + ' as a mask is <code>' + toIp(r.mask) + '</code>. The <strong>interesting octet</strong> is the ' +
                ordinal[i] + ' one (' + maskOctets[i] + '), the last octet that is not 255.</li>' +
            '<li>Block size = 256 − ' + maskOctets[i] + ' = <strong>' + block + '</strong>. Subnets in that octet start at ' + startsText + '</li>' +
            '<li>' + addrOctets[i] + ' falls in the block that starts at <strong>' + start + '</strong> and ends at <strong>' + (start + block - 1) + '</strong>.</li>' +
            '<li>Network address: that block start, with any later octets set to 0 → <code>' + toIp(r.network) + '</code></li>' +
            '<li>Broadcast address: the block end, with any later octets set to 255 → <code>' + toIp(r.broadcast) + '</code></li>' +
            '<li>Usable hosts: ' + (32 - r.prefix) + ' host bits, so 2<sup>' + (32 - r.prefix) + '</sup> − 2 = <strong>' + formatNumber(r.usable) + '</strong></li>' +
            '</ol>';
    }

    // ---- Calculator ---------------------------------------------------------
    var form = document.getElementById('subnetForm');
    var input = document.getElementById('subnetInput');
    var errorEl = document.getElementById('subnetError');
    var resultEl = document.getElementById('subnetResult');

    function positionNote(r) {
        if (r.prefix >= 31) return '';
        if (r.address === r.network) return 'This is the <strong>network address</strong> itself, so you cannot assign it to a host.';
        if (r.address === r.broadcast) return 'This is the <strong>broadcast address</strong>, so you cannot assign it to a host.';
        return 'This is usable host <strong>' + formatNumber(r.address - r.network) + '</strong> of ' + formatNumber(r.usable) + ' in its subnet.';
    }

    function renderResult(r) {
        var rows = [
            ['Network address', toIp(r.network) + '/' + r.prefix],
            ['Subnet mask', toIp(r.mask)],
            ['Wildcard mask', toIp(r.wildcard)],
            ['Broadcast address', r.prefix >= 31 ? 'None (/' + r.prefix + ')' : toIp(r.broadcast)],
            ['Usable host range', r.prefix === 32 ? toIp(r.first) : toIp(r.first) + ' – ' + toIp(r.last)],
            ['Usable hosts', formatNumber(r.usable)],
            ['Total addresses', formatNumber(r.total)],
            ['Address type', addressType(r.address)],
            ['Classful (historical)', 'Class ' + legacyClass(r.address)]
        ];
        var note = positionNote(r);

        resultEl.innerHTML =
            '<div class="table-scroll"><table class="subnet-table"><tbody>' +
            rows.map(function (row) {
                return '<tr><th scope="row">' + row[0] + '</th><td>' + escapeHtml(row[1]) + '</td></tr>';
            }).join('') +
            '</tbody></table></div>' +
            (note ? '<p class="subnet-note">' + note + '</p>' : '') +
            '<h3 class="subnet-subhead">In binary</h3>' +
            '<p class="subnet-legend"><span class="bits-net">Network bits (' + r.prefix + ')</span> <span class="bits-split" aria-hidden="true">|</span> <span class="bits-host">Host bits (' + (32 - r.prefix) + ')</span></p>' +
            '<div class="table-scroll"><table class="subnet-binary"><tbody>' +
            [['Address', r.address], ['Mask', r.mask], ['Network', r.network], ['Broadcast', r.broadcast]].map(function (row) {
                return '<tr><th scope="row">' + row[0] + '</th><td><code>' + binaryHtml(row[1], r.prefix) + '</code></td></tr>';
            }).join('') +
            '</tbody></table></div>' +
            '<h3 class="subnet-subhead">Working it out by hand</h3>' +
            '<div class="subnet-working">' + workingHtml(r) + '</div>';
    }

    function calculate() {
        var parsed = parseInput(input.value);
        if (parsed.error) {
            errorEl.textContent = parsed.error;
            input.setAttribute('aria-invalid', 'true');
            return;
        }
        errorEl.textContent = '';
        input.removeAttribute('aria-invalid');
        renderResult(analyse(parsed.address, parsed.prefix));
    }

    form.addEventListener('submit', function (event) {
        event.preventDefault();
        calculate();
    });

    // ---- Practice -----------------------------------------------------------
    var questionEl = document.getElementById('practiceQuestion');
    var practiceForm = document.getElementById('practiceForm');
    var answerInput = document.getElementById('practiceAnswer');
    var feedbackEl = document.getElementById('practiceFeedback');
    var revealBtn = document.getElementById('practiceReveal');
    var nextBtn = document.getElementById('practiceNext');
    var scoreEl = document.getElementById('practiceScore');

    var current = null;
    var stats = { attempted: 0, correct: 0, streak: 0 };

    var QUESTION_TYPES = [
        { key: 'network', ask: 'What is the <strong>network address</strong> of', kind: 'ip', hint: 'e.g. 10.0.0.0' },
        { key: 'broadcast', ask: 'What is the <strong>broadcast address</strong> of', kind: 'ip', hint: 'e.g. 10.0.0.255' },
        { key: 'first', ask: 'What is the <strong>first usable host</strong> in the subnet of', kind: 'ip', hint: 'e.g. 10.0.0.1' },
        { key: 'last', ask: 'What is the <strong>last usable host</strong> in the subnet of', kind: 'ip', hint: 'e.g. 10.0.0.254' },
        { key: 'usable', ask: 'How many <strong>usable hosts</strong> are in the subnet of', kind: 'number', hint: 'a number' },
        { key: 'mask', ask: 'What is the <strong>subnet mask</strong>, in dotted decimal, for', kind: 'ip', hint: 'e.g. 255.255.255.0' }
    ];

    function randomInt(min, max) {
        return min + Math.floor(Math.random() * (max - min + 1));
    }

    function randomAddress() {
        // Mostly private space, as in real exam questions.
        switch (randomInt(0, 3)) {
            case 0: return parseIp('10.' + randomInt(0, 255) + '.' + randomInt(0, 255) + '.' + randomInt(1, 254));
            case 1: return parseIp('172.' + randomInt(16, 31) + '.' + randomInt(0, 255) + '.' + randomInt(1, 254));
            case 2: return parseIp('192.168.' + randomInt(0, 255) + '.' + randomInt(1, 254));
            default: return parseIp(randomInt(1, 223) + '.' + randomInt(0, 255) + '.' + randomInt(0, 255) + '.' + randomInt(1, 254));
        }
    }

    function randomPrefix() {
        // Weight towards the /20 to /30 range where most exam questions sit.
        return Math.random() < 0.8 ? randomInt(20, 30) : randomInt(9, 19);
    }

    function newQuestion() {
        var type = QUESTION_TYPES[randomInt(0, QUESTION_TYPES.length - 1)];
        var r = analyse(randomAddress(), randomPrefix());
        current = { type: type, r: r, done: false };

        var subject = type.key === 'mask'
            ? '<code>/' + r.prefix + '</code>?'
            : '<code>' + toIp(r.address) + '/' + r.prefix + '</code>?';
        questionEl.innerHTML = type.ask + ' ' + subject;
        answerInput.value = '';
        answerInput.placeholder = type.hint;
        answerInput.setAttribute('inputmode', type.kind === 'number' ? 'numeric' : 'decimal');
        answerInput.disabled = false;
        practiceForm.querySelector('button[type="submit"]').disabled = false;
        revealBtn.disabled = false;
        feedbackEl.innerHTML = '';
        feedbackEl.className = 'practice-feedback';
        nextBtn.hidden = true;
    }

    function expected() {
        var r = current.r;
        return current.type.key === 'usable' ? r.usable : r[current.type.key];
    }

    function expectedText() {
        return current.type.kind === 'number' ? formatNumber(expected()) : toIp(expected());
    }

    function finish(correct, revealed) {
        current.done = true;
        stats.attempted++;
        if (correct) {
            stats.correct++;
            stats.streak++;
        } else {
            stats.streak = 0;
        }
        var r = current.r;
        var summary = current.type.key === 'mask'
            ? '<p>/' + r.prefix + ' means ' + r.prefix + ' ones followed by ' + (32 - r.prefix) +
              ' zeros: <code>' + binaryHtml(r.mask, r.prefix) + '</code> = <code>' + toIp(r.mask) + '</code>.</p>'
            : workingHtml(r);

        feedbackEl.className = 'practice-feedback ' + (correct ? 'is-correct' : 'is-incorrect');
        feedbackEl.innerHTML =
            '<p class="practice-verdict">' + (correct ? '✅ Correct.' : (revealed ? 'The answer is ' : '❌ Not quite. The answer is ') +
                (correct ? '' : '<strong>' + expectedText() + '</strong>.')) + '</p>' +
            '<details class="practice-working"' + (correct ? '' : ' open') + '><summary>How to work it out</summary>' + summary + '</details>';

        answerInput.disabled = true;
        practiceForm.querySelector('button[type="submit"]').disabled = true;
        revealBtn.disabled = true;
        nextBtn.hidden = false;
        nextBtn.focus();
        scoreEl.textContent = 'Score: ' + stats.correct + ' / ' + stats.attempted +
            (stats.streak > 1 ? ' · streak of ' + stats.streak + ' 🔥' : '');
    }

    practiceForm.addEventListener('submit', function (event) {
        event.preventDefault();
        if (!current || current.done) return;
        var raw = answerInput.value.trim();
        if (!raw) {
            answerInput.focus();
            return;
        }
        var given = current.type.kind === 'number'
            ? Number(raw.replace(/[,\s]/g, ''))
            : parseIp(raw.replace(/\/\d+$/, ''));
        if (given === null || isNaN(given)) {
            feedbackEl.className = 'practice-feedback';
            feedbackEl.innerHTML = '<p>That doesn’t look like ' + (current.type.kind === 'number' ? 'a number' : 'an IPv4 address') + '. Try again.</p>';
            return;
        }
        finish(given === expected(), false);
    });

    revealBtn.addEventListener('click', function () {
        if (current && !current.done) finish(false, true);
    });

    nextBtn.addEventListener('click', function () {
        newQuestion();
        answerInput.focus();
    });

    // ---- Tabs ---------------------------------------------------------------
    var tabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"]'));

    function selectTab(tab, focus) {
        tabs.forEach(function (t) {
            var selected = t === tab;
            t.setAttribute('aria-selected', selected ? 'true' : 'false');
            t.tabIndex = selected ? 0 : -1;
            document.getElementById(t.getAttribute('aria-controls')).hidden = !selected;
        });
        if (focus) tab.focus();
        if (tab.id === 'subnetTabPractice' && !current) newQuestion();
    }

    tabs.forEach(function (tab, index) {
        tab.addEventListener('click', function () { selectTab(tab, false); });
        tab.addEventListener('keydown', function (event) {
            var next = null;
            if (event.key === 'ArrowRight') next = tabs[(index + 1) % tabs.length];
            if (event.key === 'ArrowLeft') next = tabs[(index - 1 + tabs.length) % tabs.length];
            if (event.key === 'Home') next = tabs[0];
            if (event.key === 'End') next = tabs[tabs.length - 1];
            if (next) {
                event.preventDefault();
                selectTab(next, true);
            }
        });
    });

    root.querySelector('.tool-tabs').hidden = false;
    selectTab(tabs[0], false);
    calculate();
})();
