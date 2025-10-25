class Tweet {
	private text:string;
	time:Date;

	constructor(tweet_text:string, tweet_time:string) {
		this.text = tweet_text;
		this.time = new Date(tweet_time); // "ddd MMM D HH:mm:ss Z YYYY" works for Date
	}

	//returns either 'live_event', 'achievement', 'completed_event', or 'miscellaneous'
	get source():string {
		const t = this.text.toLowerCase();

		// completed events
		if (
			t.startsWith("just completed") ||
			t.startsWith("completed") ||
			t.includes(" completed ") ||
			t.includes("completed a") ||
			t.includes("i completed") ||
			(t.includes("with #runkeeper") && (t.includes("completed") || t.includes("just completed")))
		) {
			return "completed_event";
		}

		// live events
		if (
			t.startsWith("just posted") ||
			t.startsWith("just did") ||
			(t.startsWith("starting") && t.includes("#runkeeper")) ||
			((t.includes("i'm") || t.includes("i’m")) &&
			 (t.includes("running") || t.includes("biking") || t.includes("walking")) &&
			 t.includes("#runkeeper"))
		) {
			return "live_event";
		}

		// achievements
		if (
			t.includes("personal record") ||
			t.includes("new record") ||
			t.includes("achieved") ||
			t.includes("achievement") ||
			t.includes("set a goal")
		) {
			return "achievement";
		}

		return "miscellaneous";
	}

	//returns a boolean, whether the text includes any content written by the person tweeting.
	get written():boolean {
		const cleaned = this.stripSystemBits(this.text);
		const boiler = [
			/^just completed a\b/i,
			/^just completed\b/i,
			/^completed\b/i,
			/^just posted a\b/i,
			/with runkeeper$/i,
			/with #runkeeper$/i,
			/using runkeeper$/i,
			/using #runkeeper$/i,
			/\b(run|ride|bike|walk|hike|swim)\b\s*$/i
		];

		let user = cleaned;
		for (const rx of boiler) user = user.replace(rx, "").trim();

		// any remaining word/mention/hashtag -> written
		return user.replace(/[^\w@#]+/g, "").length > 0;
	}

	get writtenText():string {
		if (!this.written) return "";
		const cleaned = this.stripSystemBits(this.text);
		const boiler = [
			/^just completed a\b/i,
			/^just completed\b/i,
			/^completed\b/i,
			/^just posted a\b/i,
			/with runkeeper$/i,
			/with #runkeeper$/i,
			/using runkeeper$/i,
			/using #runkeeper$/i,
			/\b(run|ride|bike|walk|hike|swim)\b\s*$/i
		];
		let user = cleaned;
		for (const rx of boiler) user = user.replace(rx, "").trim();
		return user.trim();
	}

	get activityType():string {
		if (this.source != 'completed_event') return "unknown";
		const t = this.text.toLowerCase();

		let m = t.match(/\bmi\s+([a-z]+)[\.,!]?/);
		if (!m) m = t.match(/\bmiles?\s+([a-z]+)[\.,!]?/);
		if (!m) m = t.match(/\bkm\s+([a-z]+)[\.,!]?/);
		if (!m) m = t.match(/\bkilometers?\s+([a-z]+)[\.,!]?/);

		if (!m) {
			// fallback words
			const common = ["run","running","walk","walking","ride","riding","bike","biking","cycle","cycling","hike","hiking","swim","swimming","ski","skiing"];
			for (const c of common) {
				if (t.includes(" " + c) || t.endsWith(c)) {
					if (c.startsWith("run")) return "run";
					if (c.startsWith("walk")) return "walk";
					if (c.startsWith("ride") || c.startsWith("bike") || c.startsWith("cycl")) return "bike";
					if (c.startsWith("hike")) return "hike";
					if (c.startsWith("swim")) return "swim";
					if (c.startsWith("ski")) return "ski";
					return c;
				}
			}
			return "unknown";
		}

		let act = (m[1] || "").trim().replace(/[^\w]+$/,"");
		if (act.startsWith("run")) act = "run";
		else if (act.startsWith("walk")) act = "walk";
		else if (act.startsWith("ride") || act.startsWith("bike") || act.startsWith("cycl")) act = "bike";
		else if (act.startsWith("hike")) act = "hike";
		else if (act.startsWith("swim")) act = "swim";
		else if (act.startsWith("ski")) act = "ski";
		return act || "unknown";
	}

	get distance():number {
		// distance in miles for completed events
		if (this.source != 'completed_event') return NaN;
		const t = this.text.toLowerCase();
		const m = t.match(/([\d]+(?:\.\d+)?)\s*(mi|mile|miles|km|kilometer|kilometers)\b/);
		if (!m) return NaN;

		const val = parseFloat(m[1]);
		if (isNaN(val)) return NaN;

		const unit = m[2];
		if (unit.startsWith("mi") || unit.startsWith("mile")) return val;
		return val / 1.609;
	}

	getHTMLTableRow(rowNumber:number):string {
		const linked = this.text.replace(
			/(https?:\/\/\S+)/g,
			'<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
		);
		const type = (this.source === 'completed_event') ? (this.activityType || 'completed_event') : this.source;

		return `
<tr>
  <td>${rowNumber}</td>
  <td>${type}</td>
  <td>${linked}</td>
</tr>`.trim();
	}

	// Sun/Mon/Tue/etc
	get weekday(): string {
		const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
		return days[this.time.getDay()];
	}

	// BONUS:sentiment label (🙂 / 🙁 / 😐)
	get sentiment(): string {
		const base = (this.writtenText || this.stripSystemBits(this.text) || "").toLowerCase();
		const positive = ["good","great","awesome","amazing","love","fun","nice","best","happy","yay","excited","proud","strong"];
		const negative = ["tired","bad","sad","hate","sore","terrible","pain","ugh","lazy","sick","hurt","injury","slow"];

		let score = 0;
		for (const w of positive) if (this._hasWord(base, w)) score++;
		for (const w of negative) if (this._hasWord(base, w)) score--;

		if (score > 0) return "🙂 Positive";
		if (score < 0) return "🙁 Negative";
		return "😐 Neutral";
	}

	// helpers
	private stripSystemBits(raw:string):string {
		return raw
			.replace(/https?:\/\/\S+/g, "")
			.replace(/#RunKeeper/gi, "")
			.replace(/\s+/g, " ")
			.trim();
	}

	private _hasWord(text:string, word:string): boolean {
		const rx = new RegExp("\\b" + word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b");
		return rx.test(text);
	}
}
