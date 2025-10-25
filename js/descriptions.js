function parseTweets(runkeeper_tweets) {
	//Do not proceed if no tweets loaded
	if (runkeeper_tweets === undefined) {
		window.alert('No tweets returned');
		return;
	}

	// Build Tweet objects (handles common field names found in the dataset)
	// Assumes a global Tweet class from your TS build is available.
	// We do NOT rename this variable; many templates expect window.tweet_array.
	window.tweet_array = runkeeper_tweets.map(function (t, i) {
		// Try common keys; adjust if your data uses slightly different names.
		var text = t.text || '';
		var when = t.created_at || t.time || '';
		// Some templates use (text, time); others may use (id, raw). This matches the classic template.
		return new Tweet(text, when);
	});

	// Filter to just the written tweets (store globally for search)
	// Prefer the Tweet.written boolean; otherwise keep anything with non-empty user text.
	window.written_tweets = window.tweet_array.filter(function (tw) {
		if (typeof tw.written !== 'undefined') {
			return !!tw.written;
		}
		// Fallback: strip links + #RunKeeper and see if anything remains
		var cleaned = String(tw.text)
			.replace(/https?:\/\/\S+/g, '')
			.replace(/#RunKeeper/gi, '')
			.replace(/\s+/g, ' ')
			.trim();
		return cleaned.length > 0;
	});

	// Optional: if the handler is already attached, trigger an initial render to clear ???.
	// (The handler also does an initial render on attach; this is just extra-safe.)
	if (typeof window.__rk_renderSearch === 'function') {
		window.__rk_renderSearch('');
	}
}

function addEventHandlerForSearch() {
	// Cache DOM nodes by the IDs used in the provided HTML
	var input = document.getElementById('textFilter');
	var countSpan = document.getElementById('searchCount');
	var textSpan = document.getElementById('searchText');

	// Prefer the table's <tbody>; fall back to the element with id 'tweetTable' if that's the tbody itself
	var tbody = document.querySelector('#tweetTable tbody') || document.getElementById('tweetTable');
	if (!input || !countSpan || !textSpan || !tbody) {
		// If the page doesn't have these elements, just exit quietly
		return;
	}

	// --- BONUS: add "Sentiment" header dynamically so we don't edit HTML ---
	var headerRow = document.querySelector('table thead tr');
	if (headerRow) {
		var hasSentimentHeader = Array.prototype.some.call(headerRow.children, function(th){
			return th && th.textContent && th.textContent.trim().toLowerCase() === 'sentiment';
		});
		if (!hasSentimentHeader) {
			var th = document.createElement('th');
			th.setAttribute('scope', 'col');
			th.textContent = 'Sentiment';
			headerRow.appendChild(th);
		}
	}

	// Helper to build a table row; prefer Tweet.getHTMLTableRow if available
	function makeRow(tw, rowNum) {
		var sentiment = (typeof tw.sentiment !== 'undefined') ? String(tw.sentiment) : '😐 Neutral';

		if (typeof tw.getHTMLTableRow === 'function') {
			// Use the existing row, then append a cell for sentiment before </tr>
			var base = tw.getHTMLTableRow(rowNum);
			if (typeof base === 'string' && base.indexOf('</tr>') !== -1) {
				return base.replace('</tr>', '<td>' + sentiment + '</td></tr>');
			}
			// Fallback: if structure unexpected, just return base
			return base;
		}

		// Simple safe fallback if your TS method isn't ready yet
		var linked = String(tw.text).replace(
			/(https?:\/\/\S+)/g,
			'<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
		);
		var type = (tw.activityType || tw.source || '-');
		return (
			'<tr>' +
				'<td>' + rowNum + '</td>' +
				'<td>' + type + '</td>' +
				'<td>' + linked + '</td>' +
				'<td>' + sentiment + '</td>' +
			'</tr>'
		);
	}

	// Render the table on each keystroke
	function render(query) {
		var q = (query || '').trim().toLowerCase();
		textSpan.textContent = q || '(none)';

		// No query: clear table and count
		if (!q) {
			tbody.innerHTML = '';
			countSpan.textContent = '0';
			return;
		}

		// Use the written tweets pool; guard if tweets not loaded yet
		var pool = Array.isArray(window.written_tweets) ? window.written_tweets : [];

		// Prefer searching user-written text if class provides it; fallback to full text
		var matches = pool.filter(function (tw) {
			var hay = (typeof tw.writtenText !== 'undefined' && tw.writtenText !== null)
				? String(tw.writtenText)
				: String(tw.text);
			return hay.toLowerCase().indexOf(q) !== -1;
		});

		// Update count + rows
		countSpan.textContent = String(matches.length);
		tbody.innerHTML = '';
		for (var i = 0; i < matches.length; i++) {
			tbody.insertAdjacentHTML('beforeend', makeRow(matches[i], i + 1));
		}
	}

	// Expose render so parseTweets can trigger an initial clear if needed
	window.__rk_renderSearch = render;

	// Live search: update after every character
	input.addEventListener('input', function () {
		render(input.value);
	});

	// Initial render to replace the initial '???' with 0 and (none)
	render('');
}

//Wait for the DOM to load
document.addEventListener('DOMContentLoaded', function (event) {
	addEventHandlerForSearch();
	loadSavedRunkeeperTweets().then(parseTweets);
});
