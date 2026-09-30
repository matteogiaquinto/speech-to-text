import "./glide-select.css";

type GlideOption = {
  value: string;
  label: string;
  tag?: string;
};

type GlideSelectOptions = {
  ariaLabel: string;
  options: GlideOption[];
  value: string;
  onChange: (value: string) => void;
};

/**
 * Framework-free counterpart to the GlideSelect interaction used by the demo.
 * Keeping it native to this Vite example avoids adding React to the published
 * package solely for two compact controls.
 */
export class GlideSelect {
  private readonly trigger: HTMLButtonElement;
  private readonly menu: HTMLDivElement;
  private readonly list: HTMLDivElement;
  private readonly pill: HTMLSpanElement;
  private readonly options: GlideOption[];
  private readonly onChange: (value: string) => void;
  private value: string;
  private active: number | null = null;
  private open = false;
  private disabled = false;
  private closeTimer = 0;

  constructor(root: HTMLElement, config: GlideSelectOptions) {
    this.options = config.options;
    this.value = config.value;
    this.onChange = config.onChange;

    root.classList.add("glide-select");
    root.dataset.size = "sm";
    root.style.setProperty("--gs-menu-w", "176px");
    root.style.setProperty("--gs-origin", "bottom left");

    this.trigger = document.createElement("button");
    this.trigger.type = "button";
    this.trigger.className = "glide-select__trigger";
    this.trigger.setAttribute("role", "combobox");
    this.trigger.setAttribute("aria-haspopup", "listbox");
    this.trigger.setAttribute("aria-expanded", "false");
    this.trigger.setAttribute("aria-label", config.ariaLabel);

    const label = document.createElement("span");
    label.className = "glide-select__label";
    this.trigger.append(label, this.chevron());

    this.menu = document.createElement("div");
    this.menu.className = "glide-select__menu";
    this.menu.dataset.state = "closed";
    this.menu.dataset.side = "top";
    this.menu.dataset.align = "left";

    this.list = document.createElement("div");
    this.list.className = "glide-select__list";
    this.list.setAttribute("role", "listbox");
    this.list.setAttribute("aria-label", config.ariaLabel);
    this.pill = document.createElement("span");
    this.pill.className = "glide-select__pill";
    this.pill.setAttribute("aria-hidden", "true");
    this.list.append(this.pill);
    this.menu.append(this.list);
    root.append(this.trigger, this.menu);

    this.renderOptions();
    this.renderValue();

    this.trigger.addEventListener("click", () => this.toggle());
    this.trigger.addEventListener("keydown", (event) => this.onKeyDown(event));
    this.list.addEventListener("pointermove", (event) => {
      const row = (event.target as HTMLElement).closest<HTMLElement>(
        "[data-index]",
      );
      if (row) this.setActive(Number(row.dataset.index));
    });
    this.list.addEventListener("pointerleave", () => this.setActive(null));
    this.list.addEventListener("click", (event) => {
      const row = (event.target as HTMLElement).closest<HTMLElement>(
        "[data-index]",
      );
      if (row) this.pick(Number(row.dataset.index));
    });
    document.addEventListener("pointerdown", (event) => {
      if (this.open && !root.contains(event.target as Node)) this.closeMenu();
    });
  }

  getValue() {
    return this.value;
  }

  setDisabled(disabled: boolean) {
    this.disabled = disabled;
    this.trigger.disabled = disabled;
    if (disabled) this.closeMenu();
  }

  private chevron() {
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("class", "glide-select__chevron");
    icon.setAttribute("viewBox", "0 0 16 16");
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = '<path d="m5 6 3 3 3-3" />';
    return icon;
  }

  private renderOptions() {
    this.options.forEach((option, index) => {
      const row = document.createElement("div");
      row.className = "glide-select__option";
      row.dataset.index = String(index);
      row.setAttribute("role", "option");

      const name = document.createElement("span");
      name.className = "glide-select__name";
      name.textContent = option.label;
      row.append(name);

      if (option.tag) {
        const tag = document.createElement("span");
        tag.className = "glide-select__tag";
        tag.textContent = option.tag;
        row.append(tag);
      }

      const check = document.createElement("span");
      check.className = "glide-select__check";
      check.setAttribute("aria-hidden", "true");
      check.textContent = "✓";
      row.append(check);
      this.list.append(row);
    });
  }

  private renderValue() {
    const selected = this.options.findIndex(
      (option) => option.value === this.value,
    );
    const label = this.trigger.querySelector<HTMLElement>(
      ".glide-select__label",
    );
    if (label) label.textContent = this.options[selected]?.label ?? "Select…";
    this.list
      .querySelectorAll<HTMLElement>(".glide-select__option")
      .forEach((row, index) => {
        row.setAttribute("aria-selected", String(index === selected));
        row
          .querySelector<HTMLElement>(".glide-select__check")
          ?.toggleAttribute("data-on", index === selected);
      });
  }

  private toggle() {
    if (this.disabled) return;
    if (this.open) this.closeMenu();
    else this.openMenu();
  }

  private openMenu() {
    window.clearTimeout(this.closeTimer);
    this.open = true;
    this.trigger.setAttribute("aria-expanded", "true");
    this.menu.hidden = false;
    requestAnimationFrame(() => {
      this.menu.dataset.state = "open";
    });
  }

  private closeMenu() {
    if (!this.open) return;
    this.open = false;
    this.active = null;
    this.updatePill();
    this.trigger.setAttribute("aria-expanded", "false");
    this.menu.dataset.state = "closed";
    this.closeTimer = window.setTimeout(() => {
      if (!this.open) this.menu.hidden = true;
    }, 140);
  }

  private pick(index: number) {
    const option = this.options[index];
    if (!option) return;
    const changed = option.value !== this.value;
    this.value = option.value;
    this.renderValue();
    this.closeMenu();
    this.trigger.focus({ preventScroll: true });
    if (changed) this.onChange(option.value);
  }

  private setActive(index: number | null) {
    if (this.active === index) return;
    this.active = index;
    this.updatePill();
  }

  private updatePill() {
    const row = this.list.querySelector<HTMLElement>(
      `[data-index="${this.active}"]`,
    );
    if (!row) {
      this.pill.style.opacity = "0";
      return;
    }
    this.pill.style.transform = `translateY(${row.offsetTop}px)`;
    this.pill.style.opacity = "1";
  }

  private onKeyDown(event: KeyboardEvent) {
    const selected = Math.max(
      0,
      this.options.findIndex((option) => option.value === this.value),
    );
    if (
      !this.open &&
      ["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)
    ) {
      event.preventDefault();
      this.openMenu();
      this.setActive(selected);
      return;
    }
    if (!this.open) return;
    if (event.key === "Escape" || event.key === "Tab") {
      if (event.key === "Escape") event.preventDefault();
      this.closeMenu();
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      this.pick(this.active ?? selected);
      return;
    }
    if (
      event.key === "ArrowDown" ||
      event.key === "ArrowUp" ||
      event.key === "Home" ||
      event.key === "End"
    ) {
      event.preventDefault();
      const current = this.active ?? selected;
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? this.options.length - 1
            : Math.min(
                this.options.length - 1,
                Math.max(0, current + (event.key === "ArrowDown" ? 1 : -1)),
              );
      this.setActive(next);
    }
  }
}
