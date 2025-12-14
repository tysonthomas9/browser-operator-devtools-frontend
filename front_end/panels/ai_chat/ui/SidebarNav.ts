// Copyright 2025 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as Lit from '../../../ui/lit/lit.js';

const {html, Decorators} = Lit;
const {customElement} = Decorators as any;

export type SidebarNavItem = 'chat' | 'agents' | 'connectors' | 'settings' | 'workflows' | 'history' | 'help' | 'evaluations';

export interface SidebarNavProps {
  activeItem?: SidebarNavItem;
  onItemClick?: (item: SidebarNavItem) => void;
}

@customElement('ai-sidebar-nav')
export class SidebarNav extends HTMLElement {
  static readonly litTagName = Lit.StaticHtml.literal`ai-sidebar-nav`;

  #activeItem: SidebarNavItem = 'chat';
  #onItemClick?: (item: SidebarNavItem) => void;

  set activeItem(v: SidebarNavItem) { this.#activeItem = v; this.#render(); }
  set onItemClick(fn: (item: SidebarNavItem) => void | undefined) { this.#onItemClick = fn; this.#render(); }

  connectedCallback(): void { this.#render(); }

  #handleClick(item: SidebarNavItem): void {
    if (this.#onItemClick) {
      this.#onItemClick(item);
    }
    this.#activeItem = item;
    this.#render();
  }

  #render(): void {
    const navItems = [
      { id: 'chat' as const, icon: this.#getChatIcon(), label: 'Chat' },
      { id: 'agents' as const, icon: this.#getAgentsIcon(), label: 'Agents' },
      { id: 'connectors' as const, icon: this.#getConnectorsIcon(), label: 'Connectors' },
      { id: 'workflows' as const, icon: this.#getWorkflowsIcon(), label: 'Workflows' },
      { id: 'settings' as const, icon: this.#getSettingsIcon(), label: 'Settings' },
      { id: 'history' as const, icon: this.#getHistoryIcon(), label: 'History' },
      { id: 'help' as const, icon: this.#getHelpIcon(), label: 'Help' },
      { id: 'evaluations' as const, icon: this.#getEvaluationsIcon(), label: 'Evaluations' },
    ];

    Lit.render(html`
      <style>
        :host {
          display: flex;
          flex-direction: column;
          width: 36px;
          background: hsl(var(--sidebar-background, 0 0% 98%));
          border-right: 1px solid #e9e9e9;
          padding: 14px 0 18px;
          gap: 16px;
          align-items: center;
          flex-shrink: 0;
          justify-content: flex-start;
          position: static;
        }

        .nav-item {
          width: 32px;
          height: 32px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          border-radius: 8px;
          padding: 6px;
        }

        .nav-item:hover {
          background: rgba(16, 147, 244, 0.05);
        }

        .nav-item:hover svg {
          fill: hsl(var(--foreground, 217.2 32.4% 27.5%));
        }

        .nav-item.active {
          background: rgba(16, 147, 244, 0.1);
        }

        .nav-item svg {
          width: 20px;
          height: 20px;
          fill: hsl(var(--muted-foreground, 213.5 16.9% 52.5%));
          transition: fill 0.2s ease, background-color 0.2s ease;
        }

        .nav-item.active svg {
          fill: hsl(var(--primary, 213.8 97.5% 49.8%));
        }

        /* Tooltip */
        .nav-item::after {
          content: attr(title);
          position: absolute;
          left: 100%;
          top: 50%;
          transform: translateY(-50%);
          margin-left: 8px;
          padding: 4px 10px;
          background: white;
          border: 1px solid #e9e9e9;
          border-radius: 6px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          font-size: 12px;
          font-weight: 500;
          white-space: nowrap;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease;
          z-index: 1000;
        }

        .nav-item:hover::after {
          opacity: 1;
        }
      </style>
      
      ${navItems.map(item => html`
        <div 
          class="nav-item ${this.#activeItem === item.id ? 'active' : ''}"
          @click=${() => this.#handleClick(item.id)}
          title=${item.label}
          role="button"
          aria-label=${item.label}
        >
          ${item.icon}
        </div>
      `)}
    `, this, {host: this});
  }

  #getChatIcon() {
    return html`
      <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9.3748 10.0001C9.3748 10.2474 9.30149 10.489 9.16413 10.6946C9.02678 10.9002 8.83156 11.0604 8.60315 11.155C8.37474 11.2496 8.12341 11.2743 7.88093 11.2261C7.63846 11.1779 7.41573 11.0588 7.24091 10.884C7.0661 10.7092 6.94705 10.4865 6.89882 10.244C6.85058 10.0015 6.87534 9.75019 6.96995 9.52178C7.06456 9.29337 7.22477 9.09815 7.43033 8.9608C7.6359 8.82345 7.87757 8.75013 8.1248 8.75013C8.45632 8.75013 8.77426 8.88183 9.00868 9.11625C9.2431 9.35067 9.3748 9.66861 9.3748 10.0001ZM11.8748 8.75013C11.6276 8.75013 11.3859 8.82345 11.1803 8.9608C10.9748 9.09815 10.8146 9.29337 10.7199 9.52178C10.6253 9.75019 10.6006 10.0015 10.6488 10.244C10.697 10.4865 10.8161 10.7092 10.9909 10.884C11.1657 11.0588 11.3885 11.1779 11.6309 11.2261C11.8734 11.2743 12.1247 11.2496 12.3532 11.155C12.5816 11.0604 12.7768 10.9002 12.9141 10.6946C13.0515 10.489 13.1248 10.2474 13.1248 10.0001C13.1248 9.66861 12.9931 9.35067 12.7587 9.11625C12.5243 8.88183 12.2063 8.75013 11.8748 8.75013ZM18.4373 10.0001C18.4376 11.4454 18.0667 12.8666 17.36 14.1273C16.6534 15.3881 15.6347 16.4462 14.4017 17.2002C13.1687 17.9542 11.7627 18.3788 10.3184 18.4334C8.87416 18.488 7.4401 18.1707 6.1537 17.5119L3.62011 18.3595C3.3443 18.4525 3.048 18.4665 2.76463 18.4001C2.48125 18.3337 2.22205 18.1895 2.01624 17.9837C1.81043 17.7779 1.6662 17.5187 1.5998 17.2353C1.5334 16.9519 1.54747 16.6556 1.64042 16.3798L2.48495 13.8462C1.90502 12.7103 1.59017 11.4576 1.56407 10.1824C1.53797 8.90727 1.80129 7.64278 2.33425 6.48404C2.86721 5.32529 3.65593 4.30245 4.64111 3.49242C5.62629 2.68238 6.78229 2.10624 8.0222 1.8073C9.2621 1.50836 10.5536 1.4944 11.7997 1.76648C13.0458 2.03856 14.214 2.5896 15.2164 3.37816C16.2189 4.16672 17.0295 5.17228 17.5874 6.31924C18.1453 7.46619 18.4358 8.7247 18.4373 10.0001ZM16.5623 10.0001C16.5619 8.99353 16.33 8.0005 15.8844 7.09787C15.4389 6.19524 14.7916 5.40721 13.9928 4.79473C13.194 4.18225 12.265 3.76175 11.2776 3.56575C10.2903 3.36975 9.27108 3.4035 8.29887 3.6644C7.32666 3.9253 6.4275 4.40636 5.67095 5.07035C4.9144 5.73434 4.32073 6.56347 3.93588 7.49361C3.55102 8.42374 3.38529 9.42993 3.45151 10.4344C3.51773 11.4388 3.81413 12.4145 4.31777 13.2861C4.38433 13.401 4.42572 13.5288 4.43919 13.6609C4.45266 13.793 4.4379 13.9265 4.39589 14.0525L3.62011 16.3798L5.94745 15.604C6.04319 15.5722 6.14342 15.5558 6.24433 15.5556C6.40898 15.5559 6.57065 15.5995 6.71308 15.6822C7.71075 16.2595 8.84288 16.5638 9.99553 16.5645C11.1482 16.5653 12.2807 16.2624 13.2791 15.6864C14.2776 15.1104 15.1067 14.2816 15.683 13.2834C16.2594 12.2852 16.5626 11.1528 16.5623 10.0001Z" fill="currentColor"/>
      </svg>
    `;
  }

  #getAgentsIcon() {
    return html`
      <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5.625 8.125C5.625 7.87777 5.69831 7.6361 5.83566 7.43054C5.97301 7.22498 6.16824 7.06476 6.39665 6.97015C6.62505 6.87554 6.87639 6.85079 7.11886 6.89902C7.36134 6.94725 7.58407 7.0663 7.75888 7.24112C7.9337 7.41593 8.05275 7.63866 8.10098 7.88114C8.14921 8.12361 8.12446 8.37495 8.02985 8.60335C7.93524 8.83176 7.77502 9.02699 7.56946 9.16434C7.3639 9.30169 7.12223 9.375 6.875 9.375C6.54348 9.375 6.22554 9.2433 5.99112 9.00888C5.7567 8.77446 5.625 8.45652 5.625 8.125ZM13.125 9.375C13.3722 9.375 13.6139 9.30169 13.8195 9.16434C14.025 9.02699 14.1852 8.83176 14.2799 8.60335C14.3745 8.37495 14.3992 8.12361 14.351 7.88114C14.3028 7.63866 14.1837 7.41593 14.0089 7.24112C13.8341 7.0663 13.6113 6.94725 13.3689 6.89902C13.1264 6.85079 12.8751 6.87554 12.6466 6.97015C12.4182 7.06476 12.223 7.22498 12.0857 7.43054C11.9483 7.6361 11.875 7.87777 11.875 8.125C11.875 8.45652 12.0067 8.77446 12.2411 9.00888C12.4755 9.2433 12.7935 9.375 13.125 9.375ZM18.4375 6.25V15C18.4375 15.7459 18.1412 16.4613 17.6137 16.9887C17.0863 17.5162 16.3709 17.8125 15.625 17.8125H4.375C3.62908 17.8125 2.91371 17.5162 2.38626 16.9887C1.85882 16.4613 1.5625 15.7459 1.5625 15V6.25C1.5625 5.50408 1.85882 4.78871 2.38626 4.26126C2.91371 3.73382 3.62908 3.4375 4.375 3.4375H9.0625V1.25C9.0625 1.00136 9.16127 0.762903 9.33709 0.587087C9.5129 0.411272 9.75136 0.3125 10 0.3125C10.2486 0.3125 10.4871 0.411272 10.6629 0.587087C10.8387 0.762903 10.9375 1.00136 10.9375 1.25V3.4375H15.625C16.3709 3.4375 17.0863 3.73382 17.6137 4.26126C18.1412 4.78871 18.4375 5.50408 18.4375 6.25ZM16.5625 6.25C16.5625 6.00136 16.4637 5.7629 16.2879 5.58709C16.1121 5.41127 15.8736 5.3125 15.625 5.3125H4.375C4.12636 5.3125 3.8879 5.41127 3.71209 5.58709C3.53627 5.7629 3.4375 6.00136 3.4375 6.25V15C3.4375 15.2486 3.53627 15.4871 3.71209 15.6629C3.8879 15.8387 4.12636 15.9375 4.375 15.9375H15.625C15.8736 15.9375 16.1121 15.8387 16.2879 15.6629C16.4637 15.4871 16.5625 15.2486 16.5625 15V6.25Z" fill="currentColor"/>
        <path d="M6 12C9.07884 13.221 11.0119 13.3234 14 12" stroke="currentColor" stroke-width="2"/>
      </svg>
    `;
  }

  #getConnectorsIcon() {
    return html`
      <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 2H12C12.5523 2 13 2.44772 13 3V5C13 5.55228 13.4477 6 14 6H16C16.5523 6 17 6.44772 17 7V10C17 10.5523 16.5523 11 16 11H14C13.4477 11 13 11.4477 13 12V14C13 14.5523 12.5523 15 12 15H8C7.44772 15 7 14.5523 7 14V12C7 11.4477 6.55228 11 6 11H4C3.44772 11 3 10.5523 3 10V7C3 6.44772 3.44772 6 4 6H6C6.55228 6 7 5.55228 7 5V3C7 2.44772 7.44772 2 8 2Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  }

  #getWorkflowsIcon() {
    return html`
      <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 4H7V8H3V4Z" fill="none" stroke="currentColor" stroke-width="1.5"/>
        <path d="M13 4H17V8H13V4Z" fill="none" stroke="currentColor" stroke-width="1.5"/>
        <path d="M8 12H12V16H8V12Z" fill="none" stroke="currentColor" stroke-width="1.5"/>
        <path d="M5 8V10M15 8V10M10 10V12" stroke="currentColor" stroke-width="1.5"/>
      </svg>
    `;
  }

  #getSettingsIcon() {
    return html`
      <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M17.3761 12.1217C17.2423 12.0373 17.0894 11.988 16.9315 11.9786C16.7736 11.9692 16.6158 11.9999 16.473 12.0678C16.2763 12.1615 16.0586 12.2022 15.8413 12.1859C15.6241 12.1695 15.4149 12.0966 15.2345 11.9745C15.0541 11.8523 14.9087 11.6852 14.8128 11.4895C14.7169 11.2939 14.6739 11.0766 14.6878 10.8592C14.7091 10.5581 14.8374 10.2745 15.0494 10.0596C15.2614 9.84471 15.5433 9.71269 15.8441 9.68735C16.0591 9.67127 16.2745 9.71167 16.4691 9.80454C16.6119 9.87321 16.7698 9.90456 16.928 9.89565C17.0863 9.88674 17.2396 9.83786 17.3739 9.75359C17.5081 9.66932 17.6187 9.5524 17.6955 9.41375C17.7723 9.27511 17.8126 9.11927 17.8128 8.96079V5.62485C17.8128 5.21045 17.6482 4.81302 17.3552 4.52C17.0622 4.22697 16.6647 4.06235 16.2503 4.06235H13.7503C13.7496 3.63552 13.6618 3.21333 13.4923 2.82161C13.3228 2.42989 13.0751 2.07689 12.7644 1.78423C12.4536 1.49027 12.0854 1.26383 11.6828 1.11916C11.2803 0.974482 10.8521 0.91471 10.4253 0.9436C9.67239 0.993076 8.96265 1.31277 8.42666 1.84388C7.89068 2.37499 7.5645 3.08178 7.50814 3.83423C7.50032 3.91157 7.50032 3.98423 7.50032 4.06235H5.00032C4.58592 4.06235 4.1885 4.22697 3.89547 4.52C3.60244 4.81302 3.43782 5.21045 3.43782 5.62485V7.81235C3.011 7.81305 2.5888 7.90085 2.19708 8.07037C1.80536 8.2399 1.45237 8.4876 1.1597 8.79829C0.755447 9.22868 0.481404 9.7648 0.369319 10.3445C0.257233 10.9243 0.311692 11.5239 0.526385 12.074C0.741079 12.624 1.10722 13.102 1.5824 13.4525C2.05757 13.8031 2.62234 14.0118 3.21126 14.0545C3.2866 14.061 3.36222 14.0636 3.43782 14.0623V16.2498C3.43782 16.6643 3.60244 17.0617 3.89547 17.3547C4.1885 17.6477 4.58592 17.8123 5.00032 17.8123H16.2503C16.6647 17.8123 17.0622 17.6477 17.3552 17.3547C17.6482 17.0617 17.8128 16.6643 17.8128 16.2498V12.9147C17.8129 12.7564 17.7729 12.6007 17.6965 12.462C17.6202 12.3233 17.5099 12.2063 17.3761 12.1217ZM15.9378 15.9373H5.31282V12.9147C5.31284 12.7565 5.27282 12.6008 5.19648 12.4622C5.12013 12.3237 5.00996 12.2067 4.87622 12.1221C4.74248 12.0376 4.58952 11.9883 4.43159 11.9788C4.27365 11.9693 4.11589 11.9999 3.97298 12.0678C3.77739 12.1619 3.56055 12.2031 3.34407 12.1873C3.044 12.1622 2.76274 12.0308 2.55082 11.8169C2.33889 11.6029 2.21019 11.3205 2.18782 11.0202C2.17335 10.8027 2.21596 10.5853 2.31143 10.3894C2.4069 10.1936 2.55192 10.026 2.7321 9.90351C2.91228 9.78096 3.12137 9.70765 3.33862 9.69084C3.55587 9.67403 3.77375 9.7143 3.97064 9.80766C4.11364 9.8761 4.27166 9.90715 4.42992 9.89792C4.58818 9.88868 4.74152 9.83947 4.8756 9.75487C5.00967 9.67028 5.1201 9.55306 5.19657 9.41419C5.27303 9.27532 5.31303 9.11932 5.31282 8.96079V5.93735H8.64876C8.80691 5.93724 8.96247 5.89711 9.10094 5.82072C9.23942 5.74432 9.35632 5.63414 9.44076 5.50042C9.5252 5.3667 9.57445 5.21379 9.5839 5.05592C9.59336 4.89805 9.56273 4.74035 9.49486 4.59751C9.40075 4.40191 9.35954 4.18508 9.37533 3.9686C9.40036 3.66847 9.53167 3.38713 9.74563 3.17517C9.95959 2.96321 10.2422 2.83456 10.5425 2.81235C10.7599 2.7978 10.9773 2.84032 11.1732 2.9357C11.3691 3.03107 11.5366 3.17599 11.6592 3.35608C11.7819 3.53617 11.8553 3.74518 11.8722 3.96239C11.8891 4.1796 11.849 4.39746 11.7558 4.59438C11.6872 4.73741 11.656 4.89552 11.6651 5.05389C11.6743 5.21227 11.7235 5.36573 11.8081 5.49991C11.8927 5.6341 12.01 5.74462 12.149 5.82112C12.2879 5.89763 12.444 5.93762 12.6027 5.93735H15.9378V7.81235C15.8597 7.81235 15.787 7.81235 15.7113 7.82094C14.9052 7.88084 14.1536 8.25074 13.6145 8.85298C13.0754 9.45522 12.7905 10.2429 12.8199 11.0507C12.8492 11.8585 13.1904 12.6235 13.7718 13.1851C14.3531 13.7466 15.1295 14.0611 15.9378 14.0623V15.9373Z" fill="currentColor"/>
      </svg>
    `;
  }

  #getHistoryIcon() {
    return html`
      <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3.75 10a6.25 6.25 0 1 1 6.25 6.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M10 5.625V10l3.125 1.875" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M3.75 10H1.875M3.75 10L5.625 8.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  }

  #getHelpIcon() {
    return html`
      <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 1.875C5.82436 1.875 2.5 5.19936 2.5 9.375C2.5 13.5506 5.82436 16.875 10 16.875C14.1756 16.875 17.5 13.5506 17.5 9.375C17.5 5.19936 14.1756 1.875 10 1.875Z" stroke="currentColor" stroke-width="1.5"/>
        <path d="M10 13.125H10.0063" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M10 10.625C10 9.16667 12 9.0625 12 7.1875C12 6.08446 11.103 5.1875 10 5.1875C8.89697 5.1875 8 6.08446 8 7.1875" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  }

  #getEvaluationsIcon() {
    return html`
      <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 12.5L7.5 9L10.5 12L15.5 6.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M4 17.5H16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M4 2.5H16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M7.5 9V2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M10.5 12V17.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M13.5 6.5V2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'ai-sidebar-nav': SidebarNav; }
}
