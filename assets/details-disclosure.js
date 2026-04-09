


class DetailsDisclosure extends HTMLElement {
  constructor() {
    super();
    this.mainDetailsToggle = this.querySelector('details');
    this.content = this.mainDetailsToggle.querySelector('summary').nextElementSibling;

    this.mainDetailsToggle.addEventListener('focusout', this.onFocusOut.bind(this));
    this.mainDetailsToggle.addEventListener('toggle', this.onToggle.bind(this));
  }

  onFocusOut() {
    setTimeout(() => {
      if (!this.contains(document.activeElement)) this.close();
    });
  }

  onToggle() {
    if (!this.animations) this.animations = this.content.getAnimations();

    if (this.mainDetailsToggle.hasAttribute('open')) {
      this.animations.forEach((animation) => animation.play());
    } else {
      this.animations.forEach((animation) => animation.cancel());
    }
  }

  close() {
    this.mainDetailsToggle.removeAttribute('open');
    this.mainDetailsToggle.querySelector('summary').setAttribute('aria-expanded', false);
  }
}

customElements.define('details-disclosure', DetailsDisclosure);

class HeaderMenu extends DetailsDisclosure {
  constructor() {
    super();
    this.header = document.querySelector('.header-wrapper');
    this.syncMenuHeight = this.syncMenuHeight.bind(this);
    this.subMenus = Array.from(this.mainDetailsToggle.querySelectorAll('details.mega-menu.submenu'));

    let items = document.querySelector(".header__inline-menu").querySelectorAll("details");

    items.forEach(item => {
      item.addEventListener("mouseover", () => {
        item.setAttribute("open", true);
        item.querySelector("ul").addEventListener("mouseleave", () => {
          item.removeAttribute("open");
        });
        item.addEventListener("mouseleave", () => {
          item.removeAttribute("open");
        });
      });

      item.addEventListener("click", async (e) => {
        console.log (e.target);
        return;
          window.location.href = item.dataset.url;
      });

    });

    this.subMenus.forEach((subMenu) => {
      subMenu.addEventListener('toggle', () => {
        if (subMenu.open) this.syncMenuHeight(subMenu);
      });
    });

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.syncMenuHeight());
      [
        this.mainDetailsToggle.querySelector('.rootmenu.menu-wrapper'),
        this.mainDetailsToggle.querySelector('.promo-card-wrapper'),
        ...this.mainDetailsToggle.querySelectorAll('.submenu.menu-wrapper'),
        ...this.mainDetailsToggle.querySelectorAll('.submenu.menu-wrapper ul'),
      ]
        .filter(Boolean)
        .forEach((element) => this.resizeObserver.observe(element));
    }

  }

  getRootContent() {
    return Array.from(this.mainDetailsToggle.children).find((child) => child.classList?.contains('mega-menu__content'));
  }

  getActiveSubMenu() {
    return this.subMenus.find((subMenu) => subMenu.hasAttribute('open')) || this.subMenus[0];
  }

  syncMenuHeight(activeSubMenu = this.getActiveSubMenu()) {
    const rootContent = this.getRootContent();
    if (!rootContent) return;

    const rootMenuWrapper = this.mainDetailsToggle.querySelector('.rootmenu.menu-wrapper');
    const promoWrapper = this.mainDetailsToggle.querySelector('.promo-card-wrapper');
    const submenuWrapper = activeSubMenu?.querySelector('.submenu.menu-wrapper');
    const submenuList = submenuWrapper?.querySelector('ul');
    const height = Math.max(
      rootMenuWrapper?.scrollHeight || 0,
      promoWrapper?.scrollHeight || 0,
      submenuWrapper?.scrollHeight || 0,
      submenuList?.scrollHeight || 0
    );

    if (!height) {
      rootContent.style.removeProperty('height');
      return;
    }

    rootContent.style.height = `${height}px`;
  }

  openFirstSubMenu() {
    const subMenus = this.mainDetailsToggle.querySelectorAll('details.mega-menu.submenu');
    if (!subMenus.length) return;

    subMenus.forEach((subMenu, index) => {
      const isFirst = index === 0;
      if (isFirst) {
        subMenu.setAttribute('open', '');
      } else {
        subMenu.removeAttribute('open');
      }

      const summary = subMenu.querySelector('summary');
      if (summary) summary.setAttribute('aria-expanded', isFirst ? 'true' : 'false');
    });

    this.syncMenuHeight(subMenus[0]);
  }

  onToggle() {
    if (!this.header) return;
    this.header.preventHide = this.mainDetailsToggle.open;

    if (this.mainDetailsToggle.open) {
      this.openFirstSubMenu();
    } else {
      const rootContent = this.getRootContent();
      if (rootContent) rootContent.style.removeProperty('height');
    }

    if (document.documentElement.style.getPropertyValue('--header-bottom-position-desktop') !== '') return;
    document.documentElement.style.setProperty(
      '--header-bottom-position-desktop',
      `${Math.floor(this.header.getBoundingClientRect().bottom)}px`
    );
  }
}

customElements.define('header-menu', HeaderMenu);

class SubMenu extends DetailsDisclosure {
  constructor() {
    super();
    this.submenuDetails = this.querySelector('.mega-menu.submenu');
    this.submenu = this.querySelector('.submenu.mega-menu__content');
    [this.submenuDetails, this.submenu].forEach(e => { e.addEventListener('mouseout', this.close.bind(this)) })
  }

}

customElements.define('sub-menu', SubMenu);
