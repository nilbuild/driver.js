import { driver } from "driver.js/headless";

export function startAssistantTour(chat) {
  chat.setAttribute("role", "log");

  const say = (html, kind = "bot") => {
    const message = document.createElement("p");
    message.className = `chat-message ${kind}`;
    message.innerHTML = html;
    chat.append(message);
    chat.scrollTop = chat.scrollHeight;
    return message;
  };

  const tour = driver({
    steps: [
      {
        element: "#ha-upload",
        advanceOn: "click",
        data: { say: "Hi! Let's share a file. Click <b>Upload</b>." },
      },
      {
        element: "#ha-share",
        waitForElement: 5000,
        advanceOn: "click",
        data: { say: "It's up. Now click <b>Share</b> next to it." },
      },
      {
        element: "#ha-copy",
        advanceOn: "click",
        data: { say: "Last one: <b>Copy link</b>." },
      },
    ],
    onHighlightStarted: (element, step) => {
      say(step.data.say);
    },
    onWaitingForElement: (element, step, opts) => {
      const typing = say("Uploading…", "typing");
      opts.signal.addEventListener("abort", () => typing.remove());
    },
    onDestroyed: (element, step, opts) => {
      say(opts.reason === "done" ? "All set! 🎉" : "Talk later 👋");
    },
  });

  tour.drive();
  return tour;
}
