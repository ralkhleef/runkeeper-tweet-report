function parseTweets(runkeeper_tweets) {
	// Do not proceed if no tweets loaded
	if (runkeeper_tweets === undefined) {
		window.alert('No tweets returned');
		return;
	}

	// Build Tweet objects
	window.tweet_array = runkeeper_tweets.map(function (tweet) {
		return new Tweet(tweet.text, tweet.created_at);
	});

	// tiny helpers 
	function setTextById(id, val) {
		var el = document.getElementById(id);
		if (el) el.textContent = val;
	}
	function setAllByClass(cls, val) {
		var nodes = document.getElementsByClassName(cls);
		for (var i = 0; i < nodes.length; i++) nodes[i].textContent = val;
	}
	function pctOf(part, whole) {
		if (!whole) return '0.00%';
		return ( (part / whole) * 100 ).toFixed(2) + '%';
	}

	// counts & dates
	setTextById('numberTweets', tweet_array.length);

	// earliest & latest dates
	var times = tweet_array.map(function (t) { return t.time.getTime(); });
	var earliest = new Date(Math.min.apply(null, times));
	var latest   = new Date(Math.max.apply(null, times));

	var dateFmt = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
	setTextById('firstDate', earliest.toLocaleDateString(undefined, dateFmt));
	setTextById('lastDate',  latest.toLocaleDateString(undefined, dateFmt));

	// categories 
	var counts = { completed_event: 0, live_event: 0, achievement: 0, miscellaneous: 0 };
	tweet_array.forEach(function (t) {
		if (counts.hasOwnProperty(t.source)) counts[t.source]++; else counts.miscellaneous++;
	});

	// Fill raw counts from html files
	setAllByClass('completedEvents', counts.completed_event);
	setAllByClass('liveEvents',      counts.live_event);
	setAllByClass('achievements',    counts.achievement);
	setAllByClass('miscellaneous',   counts.miscellaneous);

	// Fill percentages of total
	var total = tweet_array.length;
	setAllByClass('completedEventsPct', pctOf(counts.completed_event, total));
	setAllByClass('liveEventsPct',      pctOf(counts.live_event,      total));
	setAllByClass('achievementsPct',    pctOf(counts.achievement,     total));
	setAllByClass('miscellaneousPct',   pctOf(counts.miscellaneous,   total));

	// written text among completed_event 
	var completedTweets = tweet_array.filter(function (t) { return t.source === 'completed_event'; });
	var completedWritten = completedTweets.filter(function (t) { return t.written === true; });

	// The paragraph repeats the completed count again via class "completedEvents"
	// (we already set it above), now fill the written count and percent among completed.
	setAllByClass('written', completedWritten.length);
	setAllByClass('writtenPct', pctOf(completedWritten.length, completedTweets.length));
}

// Wait for the DOM to load
document.addEventListener('DOMContentLoaded', function () {
	loadSavedRunkeeperTweets().then(parseTweets);
});
