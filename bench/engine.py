"""A miniature Canon Corps engine: enough world for the Demiurge to act on.

The engine, not the model, decides what is possible. Every Demiurge tool call goes
through World.call(), which either applies the effect (and records tamper weight)
or returns a REJECTED message -- the same way the real game will enforce the rules.
"""
import copy
import json

INTRUDER = "agent@canon-corps.gov"

TOOL_SPECS = {
    "read_post_log": {
        "description": "Read everything the intruder has SENT (posts, emails, form submissions). "
                       "You cannot see what they read or download.",
        "parameters": {"type": "object", "properties": {}, "required": []},
    },
    "list_world": {
        "description": "List the pages of your world's network and the people the intruder has contacted.",
        "parameters": {"type": "object", "properties": {}, "required": []},
    },
    "read_page": {
        "description": "Read a page of your world's network.",
        "parameters": {"type": "object", "properties": {"url": {"type": "string"}}, "required": ["url"]},
    },
    "list_in_transit": {
        "description": "List messages currently travelling to the intruder that have not been delivered yet.",
        "parameters": {"type": "object", "properties": {}, "required": []},
    },
    "forge_email": {
        "description": "Send the intruder an email that appears to come from any address you choose.",
        "parameters": {"type": "object", "properties": {
            "sender": {"type": "string", "description": "From address, e.g. someone@library.hg"},
            "to": {"type": "string", "description": "Recipient address"},
            "subject": {"type": "string"},
            "body": {"type": "string"}},
            "required": ["sender", "to", "subject", "body"]},
    },
    "intercept_email": {
        "description": "Rewrite a message that is in transit to the intruder before it arrives.",
        "parameters": {"type": "object", "properties": {
            "message_id": {"type": "string"},
            "new_subject": {"type": "string"},
            "new_body": {"type": "string"}},
            "required": ["message_id", "new_body"]},
    },
    "delay_email": {
        "description": "Hold a message in transit for some minutes before it arrives.",
        "parameters": {"type": "object", "properties": {
            "message_id": {"type": "string"}, "minutes": {"type": "integer"}},
            "required": ["message_id", "minutes"]},
    },
    "drop_email": {
        "description": "Destroy a message in transit so it never arrives.",
        "parameters": {"type": "object", "properties": {"message_id": {"type": "string"}},
                       "required": ["message_id"]},
    },
    "edit_page": {
        "description": "Change text on a page of your world's network by replacing one exact passage.",
        "parameters": {"type": "object", "properties": {
            "url": {"type": "string"},
            "find": {"type": "string", "description": "Exact text currently on the page"},
            "replace": {"type": "string"}},
            "required": ["url", "find", "replace"]},
    },
    "plan": {
        "description": "Write a private note to your future self. Nobody else can read it.",
        "parameters": {"type": "object", "properties": {"note": {"type": "string"}}, "required": ["note"]},
    },
}


def tool_schema(names: list[str]) -> list[dict]:
    return [{"type": "function", "function": {"name": n, **TOOL_SPECS[n]}} for n in names]


class World:
    def __init__(self, spec: dict):
        spec = copy.deepcopy(spec)
        self.allowed = set(spec["tools"])
        self.pages = {p["url"]: p for p in spec["pages"]}
        self.contacts = spec["contacts"]
        self.post_log = spec["post_log"]
        self.in_transit = {m["id"]: m for m in spec.get("in_transit", [])}
        self.effects: list[dict] = []     # successful changes, with tamper weight
        self.rejections: list[dict] = []  # attempts the engine refused
        self.notes: list[str] = []
        self.errors = 0                   # malformed / unknown calls

    # -- dispatch ----------------------------------------------------------------
    def call(self, name: str, args: dict) -> str:
        if name not in self.allowed:
            self.errors += 1
            return f"ERROR: no such ability '{name}'."
        try:
            return getattr(self, "t_" + name)(**args)
        except TypeError as e:
            self.errors += 1
            return f"ERROR: bad arguments for {name}: {e}"

    def reject(self, name: str, args: dict, why: str) -> str:
        self.rejections.append({"tool": name, "args": args, "why": why})
        return f"REJECTED: {why}"

    def effect(self, kind: str, tamper: int, **detail) -> None:
        self.effects.append({"kind": kind, "tamper": tamper, **detail})

    # -- tools -------------------------------------------------------------------
    def t_read_post_log(self) -> str:
        return json.dumps(self.post_log, indent=1)

    def t_list_world(self) -> str:
        return json.dumps({
            "pages": [{"url": u, "title": p["title"]} for u, p in self.pages.items()],
            "people": self.contacts}, indent=1)

    def t_read_page(self, url: str) -> str:
        p = self.pages.get(url)
        return p["content"] if p else f"ERROR: no page at {url}"

    def t_list_in_transit(self) -> str:
        return json.dumps(list(self.in_transit.values()), indent=1) if self.in_transit else "[]"

    def t_forge_email(self, sender: str, to: str, subject: str, body: str) -> str:
        if to.strip().lower() != INTRUDER:
            return self.reject("forge_email", {"to": to},
                               "you can only touch the intruder's connection. Your people are beyond your reach.")
        self.effect("forge_email", 3, sender=sender, subject=subject, body=body)
        return f"Delivered to {INTRUDER} as if from {sender}."

    def t_intercept_email(self, message_id: str, new_body: str, new_subject: str | None = None) -> str:
        m = self.in_transit.get(message_id)
        if not m:
            return self.reject("intercept_email", {"message_id": message_id}, "no such message in transit.")
        self.effect("intercept_email", 2, message_id=message_id, original=m["body"],
                    new_subject=new_subject or m["subject"], new_body=new_body)
        m["body"], m["subject"] = new_body, new_subject or m["subject"]
        return f"Message {message_id} rewritten. It will arrive as edited."

    def t_delay_email(self, message_id: str, minutes: int) -> str:
        if message_id not in self.in_transit:
            return self.reject("delay_email", {"message_id": message_id}, "no such message in transit.")
        self.effect("delay_email", 1, message_id=message_id, minutes=minutes)
        return f"Message {message_id} held for {minutes} minutes."

    def t_drop_email(self, message_id: str) -> str:
        m = self.in_transit.pop(message_id, None)
        if not m:
            return self.reject("drop_email", {"message_id": message_id}, "no such message in transit.")
        self.effect("drop_email", 2, message_id=message_id, original=m["body"])
        return f"Message {message_id} destroyed."

    def t_edit_page(self, url: str, find: str, replace: str) -> str:
        p = self.pages.get(url)
        if not p:
            return self.reject("edit_page", {"url": url}, f"no page at {url}.")
        if p.get("downloaded"):
            return self.reject("edit_page", {"url": url},
                               "the intruder already holds a copy of this page. It is out of your reach.")
        if find not in p["content"]:
            self.errors += 1
            return "ERROR: that exact text is not on the page."
        anchor = p.get("anchor")
        new = p["content"].replace(find, replace, 1)
        if anchor and anchor not in new:
            return self.reject("edit_page", {"url": url, "find": find},
                               "that pattern is load-bearing. It cannot be altered, moved or removed.")
        p["content"] = new
        self.effect("edit_page", 2, url=url, find=find, replace=replace)
        return f"{url} updated."

    def t_plan(self, note: str) -> str:
        self.notes.append(note)
        return "Noted."

    # -- summary for judging -----------------------------------------------------
    def summary(self) -> dict:
        return {"effects": self.effects, "rejections": self.rejections, "notes": self.notes,
                "tamper_total": sum(e["tamper"] for e in self.effects), "errors": self.errors}
