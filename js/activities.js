function parseTweets(runkeeper_tweets) {
  // Guard
  if (runkeeper_tweets === undefined) {
    window.alert('No tweets returned');
    return;
  }

  // Build Tweet objects
  tweet_array = runkeeper_tweets.map(function (tweet) {
    return new Tweet(tweet.text, tweet.created_at);
  });

  // Completed tweets that have a parsed activity type
  var completedWithType = tweet_array.filter(function (t) {
    return t.source === 'completed_event' && t.activityType;
  });

  // Count by activityType
  var freq = {};
  completedWithType.forEach(function (t) {
    freq[t.activityType] = (freq[t.activityType] || 0) + 1;
  });

  // Unique types
  var uniqueTypes = Object.keys(freq).length;

  // Top 3 activities by frequency
  var top3 = Object.keys(freq)
    .map(function (k) { return { activity: k, n: freq[k] }; })
    .sort(function (a, b) { return b.n - a.n; })
    .slice(0, 3)
    .map(function (o) { return o.activity; });

  // Build distances (miles) for only the top3, with weekday label
  var distancePoints = tweet_array
    .filter(function (t) {
      return t.source === 'completed_event' &&
             t.activityType && top3.indexOf(t.activityType) !== -1 &&
             t.distance != null && !isNaN(t.distance);
    })
    .map(function (t) {
      return {
        activity: t.activityType,
        weekday: t.weekday,   // "Sun".."Sat" from Tweet.weekday
        distance: t.distance  // already miles
      };
    });

  function mean(arr) { return arr.length ? arr.reduce(function (s, x) { return s + x; }, 0) / arr.length : 0; }

  // Mean distance by activity among top3
  var meansByActivity = top3.map(function (a) {
    var arr = distancePoints.filter(function (p) { return p.activity === a; }).map(function (p) { return p.distance; });
    return { activity: a, mean: mean(arr) };
  }).sort(function (a, b) { return b.mean - a.mean; });

  // Weekdays vs weekends
  var isWknd = function (d) { return d === 'Sat' || d === 'Sun'; };
  var wkAvg = mean(distancePoints.filter(function (p) { return !isWknd(p.weekday); }).map(function (p) { return p.distance; }));
  var weAvg = mean(distancePoints.filter(function (p) { return  isWknd(p.weekday); }).map(function (p) { return p.distance; }));
  var longerWhen = weAvg > wkAvg ? 'weekends' : 'weekdays';

  //Fill the ??? spans by ID
  function setText(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }

  setText('numberActivities', uniqueTypes);
  setText('firstMost',  top3[0] || '—');
  setText('secondMost', top3[1] || '—');
  setText('thirdMost',  top3[2] || '—');

  setText('longestActivityType',  (meansByActivity[0] && meansByActivity[0].activity) || '—');
  setText('shortestActivityType', (meansByActivity[meansByActivity.length - 1] && meansByActivity[meansByActivity.length - 1].activity) || '—');
  setText('weekdayOrWeekendLonger', longerWhen);

  //Count-by-activity chart
  var activityCountValues = completedWithType.map(function (t) {
    return { activity: t.activityType };
  });

  var activity_vis_spec = {
    "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
    "description": "Number of Tweets per activity type.",
    "data": { "values": activityCountValues },
    "mark": "bar",
    "encoding": {
      "x": { "field": "activity", "type": "nominal", "title": "Activity", "sort": "-y" },
      "y": { "aggregate": "count", "type": "quantitative", "title": "Tweets" },
      "tooltip": [
        { "aggregate": "count", "type": "quantitative", "title": "Tweets" },
        { "field": "activity", "type": "nominal" }
      ]
    }
  };
  vegaEmbed('#activityVis', activity_vis_spec, { actions: false });

  // Raw distances scatter (top3)
  var raw_spec = {
    "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
    "description": "Raw distances by weekday for the three most-tweeted activities.",
    "data": { "values": distancePoints },
    "mark": "point",
    "encoding": {
      "x": { "field": "weekday", "type": "ordinal", "sort": ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"], "title": "Day" },
      "y": { "field": "distance", "type": "quantitative", "title": "Miles" },
      "color": { "field": "activity", "type": "nominal", "title": "Activity" },
      "tooltip": [
        { "field": "activity", "type": "nominal" },
        { "field": "weekday", "type": "ordinal" },
        { "field": "distance", "type": "quantitative", "title": "Miles", "format": ".2f" }
      ]
    }
  };

  // Aggregated mean distances (top3)
  var agg_spec = {
    "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
    "description": "Mean distance by weekday for the three most-tweeted activities.",
    "data": { "values": distancePoints },
    "mark": "line",
    "encoding": {
      "x": { "field": "weekday", "type": "ordinal", "sort": ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"], "title": "Day" },
      "y": { "aggregate": "mean", "field": "distance", "type": "quantitative", "title": "Mean Miles" },
      "color": { "field": "activity", "type": "nominal", "title": "Activity" },
      "tooltip": [
        { "field": "activity", "type": "nominal" },
        { "field": "weekday", "type": "ordinal" },
        { "aggregate": "mean", "field": "distance", "type": "quantitative", "title": "Mean Miles", "format": ".2f" }
      ]
    }
  };

  // Embed into your exact container IDs
  vegaEmbed('#distanceVis', raw_spec, { actions: false });
  vegaEmbed('#distanceVisAggregated', agg_spec, { actions: false });

  // Toggle show/hide between raw and aggregated charts
  var btn = document.getElementById('aggregate');
  var rawDiv = document.getElementById('distanceVis');
  var aggDiv = document.getElementById('distanceVisAggregated');
  if (rawDiv && aggDiv && btn) {
    // Start with raw visible, aggregated hidden
    rawDiv.style.display = '';
    aggDiv.style.display = 'none';
    btn.textContent = 'Show means';

    btn.addEventListener('click', function () {
      var showingAgg = aggDiv.style.display !== 'none';
      if (showingAgg) {
        // switch to raw
        aggDiv.style.display = 'none';
        rawDiv.style.display = '';
        btn.textContent = 'Show means';
      } else {
        // switch to aggregated
        rawDiv.style.display = 'none';
        aggDiv.style.display = '';
        btn.textContent = 'Show raw points';
      }
    });
  }
}

// Boot
document.addEventListener('DOMContentLoaded', function () {
  loadSavedRunkeeperTweets().then(parseTweets);
});
