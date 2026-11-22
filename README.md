# CBT Mock Test (SSC JE practice)

A computer based test (CBT) environment for SSC Junior Engineer practice. You give it MCQs as a JSON file, set the time, and press **Start**. It then behaves like the real exam screen:

- An instructions page with a declaration checkbox.
- A countdown timer that submits the test automatically when time runs out.
- Section tabs, with a status summary when you point at a tab.
- A question palette with the five standard statuses: Not Visited, Not Answered, Answered, Marked for Review, and Answered & Marked for Review.
- **Save & Next**, **Mark for Review & Next**, **Clear Response** and **Back** buttons.
- Real-exam save rule: an answer counts only after **Save & Next** or **Mark for Review & Next**. You can switch this off on the start screen.
- Full screen mode; right-click and copying are blocked during the test.
- An on-screen scientific calculator (trig in degrees or radians, log, ln, powers, roots, factorial). Drag it by its title bar. You can switch it off on the start screen.
- An English/Hindi switch when your questions include Hindi.
- Recovery after a refresh. Progress is saved in the browser and the timer keeps running.
- A result page with the score, accuracy, a section-wise table, time spent per question, a full answer review with explanations, and Print / Save as PDF.

It is plain HTML, CSS and JavaScript with no build step, so it runs on GitHub Pages.

## Files

```
index.html                      the app
css/style.css                   styles
js/app.js                       all app logic
tests/index.json                the list of tests shown in the "Test library" tab
tests/sample-ssc-je-civil.json  a 30-question sample paper
.nojekyll                       tells GitHub Pages to serve the files as they are
```

## Try it on your computer

The test library loads files with `fetch`, which browsers block for pages opened straight from disk. Start a small local server:

```bash
cd /Users/sanjiv/Desktop/jyoti
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

If you just double-click `index.html`, the **Upload JSON** and **Paste JSON** tabs still work. Only the library tab needs a server.

## Host it on GitHub Pages

1. Create a new repository on GitHub.
2. Upload everything in this folder: `index.html`, `css/`, `js/`, `tests/` and `.nojekyll`.
3. In the repository, open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, then **Save**.
4. After a minute or two the site is live at `https://<your-username>.github.io/<repo-name>/`.

## Add your own tests

1. Save your question paper as a `.json` file in `tests/`, for example `tests/civil-mock-02.json`.
2. Add it to `tests/index.json`:

```json
{
  "tests": [
    { "file": "tests/sample-ssc-je-civil.json", "title": "Sample Mini Mock", "description": "30 questions · 20 min" },
    { "file": "tests/civil-mock-02.json", "title": "Civil Full Mock 02", "description": "200 questions · 120 min" }
  ]
}
```

You can also link straight to a test. It loads the paper and waits for you to press Start:

```
https://<your-username>.github.io/<repo-name>/?test=tests/civil-mock-02.json
```

## JSON format

```json
{
  "title": "SSC JE Civil Mock 1",
  "duration": 120,
  "marks": { "correct": 1, "wrong": 0.25 },
  "instructions": ["Optional extra lines shown on the instructions page."],
  "sections": [
    {
      "name": "General Intelligence & Reasoning",
      "questions": [
        {
          "id": "R1",
          "question": "Find the next number: 3, 7, 15, 31, ?",
          "options": ["61", "63", "65", "62"],
          "answer": "B",
          "explanation": "Each term is (previous × 2) + 1."
        }
      ]
    }
  ]
}
```

| Field | Required | Meaning |
|---|---|---|
| `title` | no | Name of the test. You can change it on the start screen. |
| `duration` | no | Minutes. Defaults to 120 and can be changed on the start screen. |
| `marks` | no | `{"correct": 1, "wrong": 0.25}`. These are the defaults. |
| `instructions` | no | Extra instructions shown before the test. |
| `sections[].name` | yes | Section name shown on the tab. |
| `question` | yes | Question text. |
| `options` | yes | 2 or more choices, usually 4. |
| `answer` | yes | The correct option as a letter: `"A"`, `"B"`, `"C"` or `"D"`. A number is read as a **0-based index** (`0` = A, `1` = B). |
| `explanation` | no | Shown in the answer review. |
| `image` | no | A picture for the question: a web address, or a path in the repo such as `images/q12.png`. |
| `question_hi`, `options_hi`, `explanation_hi` | no | Hindi versions. Adding them turns on the **View in** language switch. |
| `marks`, `negative` | no | Per-question marks that override the paper's marks. |

Other details:

- **Formatting:** simple HTML works in questions, options and explanations: `<b>`, `<i>`, `<sub>`, `<sup>`, `<br>`, `<table>` and `<img>`. Anything else, such as scripts and links, is removed. In text that contains HTML tags, write a literal `<` as `&lt;`.
- **Formulas:** write LaTeX between `\(` and `\)` for inline math or between `\[` and `\]` for display math. In JSON every backslash must be doubled, for example `"\\(\\dfrac{wL^2}{8}\\)"`. The MathJax library is downloaded from jsDelivr only when a paper contains formulas.
- **Flat list:** instead of `sections`, you can give one `"questions"` list where each question has a `"section"` name. The app groups them in the order they first appear.
- **Errors:** the app checks the file when you load it and lists every problem, such as a missing answer or too few options, before you can start.

The **See the JSON format** and **download a template** links on the start screen show the same information.

## Turning questions into JSON with an AI assistant

Paste your questions after a prompt like this:

> Convert the MCQs below into JSON in exactly this format: `{"title": "...", "duration": 120, "marks": {"correct": 1, "wrong": 0.25}, "sections": [{"name": "...", "questions": [{"id": "...", "question": "...", "options": ["...", "...", "...", "..."], "answer": "A", "explanation": "..."}]}]}`. Use the letters A–D for `answer`. Group the questions into these sections: General Intelligence & Reasoning, General Awareness, General Engineering. Write formulas as LaTeX inside `\\(` `\\)`, with doubled backslashes. Return only the JSON.

Always check the answer key it produces before you use the paper.

## Privacy

Everything runs in the browser. Questions, answers and results are stored only in that browser's `localStorage`, and nothing is sent anywhere. The only outside request is MathJax, and only for papers with formulas.
