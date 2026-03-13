import { bench, describe } from 'vitest';
import { parseForESLint as parseGjsGts } from '../src/parser/gjs-gts-parser.js';
import { parseForESLint as parseHbs } from '../src/parser/hbs-parser.js';

// ---------------------------------------------------------------------------
// Fixture content – representative Glimmer / Ember source at three sizes
// ---------------------------------------------------------------------------

const SMALL_GTS = `\
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { on } from '@ember/modifier';

interface Args {
  label: string;
}

export default class Counter extends Component<{ Args: Args }> {
  @tracked count = 0;

  increment = () => {
    this.count++;
  };

  <template>
    <button type="button" {{on "click" this.increment}}>
      {{@label}}: {{this.count}}
    </button>
  </template>
}
`;

const MEDIUM_GTS = `\
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { on } from '@ember/modifier';
import { fn, hash } from '@ember/helper';
import type { TOC } from '@ember/component/template-only';

interface Item {
  id: number;
  label: string;
  done: boolean;
}

interface Args {
  title: string;
  initialItems?: Item[];
}

const TodoItem: TOC<{ Args: { item: Item; onToggle: (id: number) => void } }> = <template>
  <li class={{if @item.done "done"}}>
    <label>
      <input
        type="checkbox"
        checked={{@item.done}}
        {{on "change" (fn @onToggle @item.id)}}
      />
      {{@item.label}}
    </label>
  </li>
</template>;

const EmptyState: TOC<{}> = <template>
  <p class="empty">No items yet. Add one above!</p>
</template>;

export default class TodoList extends Component<{ Args: Args }> {
  @tracked items: Item[] = this.args.initialItems ?? [];
  @tracked newLabel = '';

  @action
  addItem() {
    if (!this.newLabel.trim()) return;
    this.items = [
      ...this.items,
      { id: Date.now(), label: this.newLabel.trim(), done: false },
    ];
    this.newLabel = '';
  }

  @action
  toggleItem(id: number) {
    this.items = this.items.map((item) =>
      item.id === id ? { ...item, done: !item.done } : item,
    );
  }

  @action
  removeCompleted() {
    this.items = this.items.filter((item) => !item.done);
  }

  get completedCount() {
    return this.items.filter((i) => i.done).length;
  }

  <template>
    <section class="todo-list">
      <h1>{{@title}}</h1>

      <form {{on "submit" this.addItem}}>
        <input
          type="text"
          placeholder="New item…"
          value={{this.newLabel}}
          {{on "input" (fn (mut this.newLabel))}}
        />
        <button type="submit">Add</button>
      </form>

      {{#if this.items.length}}
        <ul>
          {{#each this.items as |item|}}
            <TodoItem @item={{item}} @onToggle={{this.toggleItem}} />
          {{/each}}
        </ul>
        <footer>
          {{this.completedCount}} / {{this.items.length}} completed
          <button type="button" {{on "click" this.removeCompleted}}>
            Remove completed
          </button>
        </footer>
      {{else}}
        <EmptyState />
      {{/if}}
    </section>
  </template>
}
`;

// Large fixture – repeat a non-trivial component pattern several times to
// simulate a real-world file that has grown over time.
const LARGE_GTS = `\
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { on } from '@ember/modifier';
import { fn, hash } from '@ember/helper';
import type { TOC } from '@ember/component/template-only';

// ── Types ──────────────────────────────────────────────────────────────────

interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  active: boolean;
}

interface Post {
  id: number;
  title: string;
  body: string;
  authorId: number;
  publishedAt: Date | null;
  tags: string[];
}

interface Comment {
  id: number;
  postId: number;
  authorId: number;
  body: string;
  createdAt: Date;
}

// ── Presentational components ──────────────────────────────────────────────

const Avatar: TOC<{ Args: { user: User; size?: 'sm' | 'md' | 'lg' } }> = <template>
  <span class="avatar avatar--{{if @size @size 'md'}}" aria-label={{@user.name}}>
    {{get @user.name 0}}
  </span>
</template>;

const Badge: TOC<{ Args: { role: User['role'] } }> = <template>
  <span class="badge badge--{{@role}}">{{@role}}</span>
</template>;

const UserCard: TOC<{ Args: { user: User; onSelect: (u: User) => void } }> = <template>
  <article class="user-card {{if @user.active '' 'inactive'}}">
    <Avatar @user={{@user}} @size="lg" />
    <div class="user-card__info">
      <strong>{{@user.name}}</strong>
      <span>{{@user.email}}</span>
      <Badge @role={{@user.role}} />
    </div>
    <button type="button" {{on "click" (fn @onSelect @user)}}>
      Select
    </button>
  </article>
</template>;

const PostSummary: TOC<{ Args: { post: Post; author: User } }> = <template>
  <div class="post-summary">
    <h2>{{@post.title}}</h2>
    <p class="post-summary__meta">
      By <Avatar @user={{@author}} @size="sm" /> {{@author.name}}
      {{#if @post.publishedAt}}
        · {{@post.publishedAt}}
      {{else}}
        · <em>Draft</em>
      {{/if}}
    </p>
    <p class="post-summary__body">{{@post.body}}</p>
    <ul class="post-summary__tags">
      {{#each @post.tags as |tag|}}
        <li class="tag">{{tag}}</li>
      {{/each}}
    </ul>
  </div>
</template>;

const CommentItem: TOC<{ Args: { comment: Comment; author: User } }> = <template>
  <div class="comment">
    <Avatar @user={{@author}} @size="sm" />
    <div class="comment__content">
      <strong>{{@author.name}}</strong>
      <time>{{@comment.createdAt}}</time>
      <p>{{@comment.body}}</p>
    </div>
  </div>
</template>;

// ── Container component ────────────────────────────────────────────────────

interface DashboardArgs {
  users: User[];
  posts: Post[];
  comments: Comment[];
}

export default class Dashboard extends Component<{ Args: DashboardArgs }> {
  @tracked selectedUser: User | null = null;
  @tracked searchQuery = '';
  @tracked activeTab: 'users' | 'posts' | 'comments' = 'users';

  @action
  selectUser(user: User) {
    this.selectedUser = user;
  }

  @action
  clearSelection() {
    this.selectedUser = null;
  }

  @action
  setTab(tab: 'users' | 'posts' | 'comments') {
    this.activeTab = tab;
    this.selectedUser = null;
  }

  @action
  updateSearch(event: Event) {
    this.searchQuery = (event.target as HTMLInputElement).value;
  }

  get filteredUsers() {
    const q = this.searchQuery.toLowerCase();
    return this.args.users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }

  get filteredPosts() {
    const q = this.searchQuery.toLowerCase();
    return this.args.posts.filter((p) => p.title.toLowerCase().includes(q));
  }

  get postsWithAuthors() {
    return this.filteredPosts.map((post) => ({
      post,
      author: this.args.users.find((u) => u.id === post.authorId)!,
    }));
  }

  get commentsWithAuthors() {
    return this.args.comments.map((comment) => ({
      comment,
      author: this.args.users.find((u) => u.id === comment.authorId)!,
    }));
  }

  <template>
    <main class="dashboard">
      <header class="dashboard__header">
        <h1>Dashboard</h1>
        <input
          type="search"
          placeholder="Search…"
          value={{this.searchQuery}}
          {{on "input" this.updateSearch}}
        />
      </header>

      <nav class="dashboard__tabs">
        <button
          type="button"
          class={{if (eq this.activeTab "users") "active"}}
          {{on "click" (fn this.setTab "users")}}
        >
          Users ({{this.filteredUsers.length}})
        </button>
        <button
          type="button"
          class={{if (eq this.activeTab "posts") "active"}}
          {{on "click" (fn this.setTab "posts")}}
        >
          Posts ({{this.postsWithAuthors.length}})
        </button>
        <button
          type="button"
          class={{if (eq this.activeTab "comments") "active"}}
          {{on "click" (fn this.setTab "comments")}}
        >
          Comments ({{this.args.comments.length}})
        </button>
      </nav>

      <section class="dashboard__content">
        {{#if (eq this.activeTab "users")}}
          {{#if this.selectedUser}}
            <div class="detail-panel">
              <button type="button" {{on "click" this.clearSelection}}>← Back</button>
              <UserCard @user={{this.selectedUser}} @onSelect={{this.selectUser}} />
            </div>
          {{else}}
            <div class="user-grid">
              {{#each this.filteredUsers as |user|}}
                <UserCard @user={{user}} @onSelect={{this.selectUser}} />
              {{/each}}
            </div>
          {{/if}}
        {{else if (eq this.activeTab "posts")}}
          <div class="post-list">
            {{#each this.postsWithAuthors as |entry|}}
              <PostSummary @post={{entry.post}} @author={{entry.author}} />
            {{/each}}
          </div>
        {{else}}
          <div class="comment-list">
            {{#each this.commentsWithAuthors as |entry|}}
              <CommentItem @comment={{entry.comment}} @author={{entry.author}} />
            {{/each}}
          </div>
        {{/if}}
      </section>
    </main>
  </template>
}
`;

// ---------------------------------------------------------------------------
// GJS fixtures (same patterns without TypeScript types)
// ---------------------------------------------------------------------------

const SMALL_GJS = `\
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { on } from '@ember/modifier';

export default class Counter extends Component {
  @tracked count = 0;

  increment = () => {
    this.count++;
  };

  <template>
    <button type="button" {{on "click" this.increment}}>
      {{@label}}: {{this.count}}
    </button>
  </template>
}
`;

const MEDIUM_GJS = `\
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { on } from '@ember/modifier';
import { fn } from '@ember/helper';

const TodoItem = <template>
  <li class={{if @item.done "done"}}>
    <label>
      <input
        type="checkbox"
        checked={{@item.done}}
        {{on "change" (fn @onToggle @item.id)}}
      />
      {{@item.label}}
    </label>
  </li>
</template>;

const EmptyState = <template>
  <p class="empty">No items yet. Add one above!</p>
</template>;

export default class TodoList extends Component {
  @tracked items = [];
  @tracked newLabel = '';

  @action
  addItem() {
    if (!this.newLabel.trim()) return;
    this.items = [
      ...this.items,
      { id: Date.now(), label: this.newLabel.trim(), done: false },
    ];
    this.newLabel = '';
  }

  @action
  toggleItem(id) {
    this.items = this.items.map((item) =>
      item.id === id ? { ...item, done: !item.done } : item,
    );
  }

  @action
  removeCompleted() {
    this.items = this.items.filter((item) => !item.done);
  }

  get completedCount() {
    return this.items.filter((i) => i.done).length;
  }

  <template>
    <section class="todo-list">
      <h1>{{@title}}</h1>
      <form {{on "submit" this.addItem}}>
        <input
          type="text"
          placeholder="New item…"
          value={{this.newLabel}}
          {{on "input" (fn (mut this.newLabel))}}
        />
        <button type="submit">Add</button>
      </form>
      {{#if this.items.length}}
        <ul>
          {{#each this.items as |item|}}
            <TodoItem @item={{item}} @onToggle={{this.toggleItem}} />
          {{/each}}
        </ul>
        <footer>
          {{this.completedCount}} / {{this.items.length}} completed
          <button type="button" {{on "click" this.removeCompleted}}>
            Remove completed
          </button>
        </footer>
      {{else}}
        <EmptyState />
      {{/if}}
    </section>
  </template>
}
`;

const LARGE_GJS = `\
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { on } from '@ember/modifier';
import { fn } from '@ember/helper';

const Avatar = <template>
  <span class="avatar avatar--{{if @size @size 'md'}}" aria-label={{@user.name}}>
    {{get @user.name 0}}
  </span>
</template>;

const Badge = <template>
  <span class="badge badge--{{@role}}">{{@role}}</span>
</template>;

const UserCard = <template>
  <article class="user-card {{if @user.active '' 'inactive'}}">
    <Avatar @user={{@user}} @size="lg" />
    <div class="user-card__info">
      <strong>{{@user.name}}</strong>
      <span>{{@user.email}}</span>
      <Badge @role={{@user.role}} />
    </div>
    <button type="button" {{on "click" (fn @onSelect @user)}}>
      Select
    </button>
  </article>
</template>;

const PostSummary = <template>
  <div class="post-summary">
    <h2>{{@post.title}}</h2>
    <p class="post-summary__meta">
      By <Avatar @user={{@author}} @size="sm" /> {{@author.name}}
      {{#if @post.publishedAt}}
        · {{@post.publishedAt}}
      {{else}}
        · <em>Draft</em>
      {{/if}}
    </p>
    <p class="post-summary__body">{{@post.body}}</p>
    <ul class="post-summary__tags">
      {{#each @post.tags as |tag|}}
        <li class="tag">{{tag}}</li>
      {{/each}}
    </ul>
  </div>
</template>;

const CommentItem = <template>
  <div class="comment">
    <Avatar @user={{@author}} @size="sm" />
    <div class="comment__content">
      <strong>{{@author.name}}</strong>
      <time>{{@comment.createdAt}}</time>
      <p>{{@comment.body}}</p>
    </div>
  </div>
</template>;

export default class Dashboard extends Component {
  @tracked selectedUser = null;
  @tracked searchQuery = '';
  @tracked activeTab = 'users';

  @action
  selectUser(user) {
    this.selectedUser = user;
  }

  @action
  clearSelection() {
    this.selectedUser = null;
  }

  @action
  setTab(tab) {
    this.activeTab = tab;
    this.selectedUser = null;
  }

  @action
  updateSearch(event) {
    this.searchQuery = event.target.value;
  }

  get filteredUsers() {
    const q = this.searchQuery.toLowerCase();
    return this.args.users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }

  get filteredPosts() {
    const q = this.searchQuery.toLowerCase();
    return this.args.posts.filter((p) => p.title.toLowerCase().includes(q));
  }

  get postsWithAuthors() {
    return this.filteredPosts.map((post) => ({
      post,
      author: this.args.users.find((u) => u.id === post.authorId),
    }));
  }

  get commentsWithAuthors() {
    return this.args.comments.map((comment) => ({
      comment,
      author: this.args.users.find((u) => u.id === comment.authorId),
    }));
  }

  <template>
    <main class="dashboard">
      <header class="dashboard__header">
        <h1>Dashboard</h1>
        <input
          type="search"
          placeholder="Search…"
          value={{this.searchQuery}}
          {{on "input" this.updateSearch}}
        />
      </header>

      <nav class="dashboard__tabs">
        <button
          type="button"
          class={{if (eq this.activeTab "users") "active"}}
          {{on "click" (fn this.setTab "users")}}
        >
          Users ({{this.filteredUsers.length}})
        </button>
        <button
          type="button"
          class={{if (eq this.activeTab "posts") "active"}}
          {{on "click" (fn this.setTab "posts")}}
        >
          Posts ({{this.postsWithAuthors.length}})
        </button>
        <button
          type="button"
          class={{if (eq this.activeTab "comments") "active"}}
          {{on "click" (fn this.setTab "comments")}}
        >
          Comments ({{this.args.comments.length}})
        </button>
      </nav>

      <section class="dashboard__content">
        {{#if (eq this.activeTab "users")}}
          {{#if this.selectedUser}}
            <div class="detail-panel">
              <button type="button" {{on "click" this.clearSelection}}>← Back</button>
              <UserCard @user={{this.selectedUser}} @onSelect={{this.selectUser}} />
            </div>
          {{else}}
            <div class="user-grid">
              {{#each this.filteredUsers as |user|}}
                <UserCard @user={{user}} @onSelect={{this.selectUser}} />
              {{/each}}
            </div>
          {{/if}}
        {{else if (eq this.activeTab "posts")}}
          <div class="post-list">
            {{#each this.postsWithAuthors as |entry|}}
              <PostSummary @post={{entry.post}} @author={{entry.author}} />
            {{/each}}
          </div>
        {{else}}
          <div class="comment-list">
            {{#each this.commentsWithAuthors as |entry|}}
              <CommentItem @comment={{entry.comment}} @author={{entry.author}} />
            {{/each}}
          </div>
        {{/if}}
      </section>
    </main>
  </template>
}
`;

// ---------------------------------------------------------------------------
// HBS fixtures
// ---------------------------------------------------------------------------

const SMALL_HBS = `\
<h1>Hello, {{@name}}!</h1>
<p>Welcome to {{@appName}}.</p>
`;

const MEDIUM_HBS = `\
<nav class="sidebar">
  <h2>Navigation</h2>
  <ul>
    {{#each @items as |item|}}
      <li class={{if item.active "active"}}>
        <a href={{item.url}}>{{item.label}}</a>
        {{#if item.children}}
          <ul class="submenu">
            {{#each item.children as |child|}}
              <li><a href={{child.url}}>{{child.label}}</a></li>
            {{/each}}
          </ul>
        {{/if}}
      </li>
    {{/each}}
  </ul>
</nav>

<main class="content">
  {{#if @isLoading}}
    <p class="loading">Loading…</p>
  {{else if @error}}
    <div class="error-banner">
      <strong>Error:</strong> {{@error.message}}
      <button type="button" {{on "click" @onRetry}}>Retry</button>
    </div>
  {{else}}
    {{#each @posts as |post|}}
      <article class="post">
        <h2>{{post.title}}</h2>
        <p class="meta">
          By {{post.author.name}}
          {{#if post.publishedAt}}· {{post.publishedAt}}{{/if}}
        </p>
        <p>{{post.excerpt}}</p>
        <ul class="tags">
          {{#each post.tags as |tag|}}
            <li class="tag">{{tag}}</li>
          {{/each}}
        </ul>
        <a href={{post.url}} class="read-more">Read more →</a>
      </article>
    {{else}}
      <p class="empty">No posts found.</p>
    {{/each}}
  {{/if}}
</main>
`;

const LARGE_HBS = `\
<div class="app-layout">
  <header class="app-header">
    <a href="/" class="logo">{{@appName}}</a>
    <nav class="primary-nav">
      {{#each @navItems as |item|}}
        <a
          href={{item.url}}
          class="nav-link {{if item.active 'nav-link--active'}}"
        >
          {{item.label}}
          {{#if item.badge}}
            <span class="badge">{{item.badge}}</span>
          {{/if}}
        </a>
      {{/each}}
    </nav>
    <div class="header-actions">
      {{#if @currentUser}}
        <div class="user-menu">
          <button type="button" {{on "click" @onOpenUserMenu}}>
            <img
              src={{@currentUser.avatarUrl}}
              alt={{@currentUser.name}}
              class="avatar"
            />
            {{@currentUser.name}}
          </button>
          {{#if @isUserMenuOpen}}
            <ul class="dropdown">
              <li><a href="/profile">Profile</a></li>
              <li><a href="/settings">Settings</a></li>
              <li>
                <button type="button" {{on "click" @onSignOut}}>Sign out</button>
              </li>
            </ul>
          {{/if}}
        </div>
      {{else}}
        <a href="/login" class="btn btn--primary">Log in</a>
        <a href="/register" class="btn">Register</a>
      {{/if}}
    </div>
  </header>

  <div class="app-body">
    <aside class="sidebar">
      <section class="sidebar__section">
        <h3>Categories</h3>
        <ul>
          {{#each @categories as |cat|}}
            <li class={{if (eq @selectedCategory cat.id) "active"}}>
              <a href={{cat.url}}>
                {{cat.name}}
                <span class="count">({{cat.count}})</span>
              </a>
            </li>
          {{/each}}
        </ul>
      </section>

      <section class="sidebar__section">
        <h3>Tags</h3>
        <div class="tag-cloud">
          {{#each @popularTags as |tag|}}
            <a
              href={{tag.url}}
              class="tag tag--{{tag.size}}"
            >
              {{tag.name}}
            </a>
          {{/each}}
        </div>
      </section>

      <section class="sidebar__section">
        <h3>Recent Activity</h3>
        <ul class="activity-feed">
          {{#each @recentActivity as |activity|}}
            <li class="activity-item">
              <img
                src={{activity.actor.avatarUrl}}
                alt={{activity.actor.name}}
                class="avatar avatar--sm"
              />
              <div class="activity-item__body">
                <strong>{{activity.actor.name}}</strong>
                {{activity.verb}}
                <a href={{activity.target.url}}>{{activity.target.label}}</a>
              </div>
              <time class="activity-item__time">{{activity.createdAt}}</time>
            </li>
          {{/each}}
        </ul>
      </section>
    </aside>

    <main class="main-content">
      <div class="toolbar">
        <input
          type="search"
          class="search-input"
          placeholder="Search…"
          value={{@searchQuery}}
          {{on "input" @onSearch}}
        />
        <div class="toolbar__actions">
          <button
            type="button"
            class="btn btn--sm {{if (eq @viewMode 'grid') 'btn--active'}}"
            {{on "click" (fn @setViewMode "grid")}}
          >
            Grid
          </button>
          <button
            type="button"
            class="btn btn--sm {{if (eq @viewMode 'list') 'btn--active'}}"
            {{on "click" (fn @setViewMode "list")}}
          >
            List
          </button>
        </div>
        <div class="sort-control">
          <label for="sort-select">Sort by</label>
          <select
            id="sort-select"
            {{on "change" @onSortChange}}
          >
            {{#each @sortOptions as |opt|}}
              <option
                value={{opt.value}}
                selected={{eq @currentSort opt.value}}
              >
                {{opt.label}}
              </option>
            {{/each}}
          </select>
        </div>
      </div>

      {{#if @isLoading}}
        <div class="loading-overlay">
          <span class="spinner" aria-label="Loading…"></span>
        </div>
      {{else if @error}}
        <div class="error-banner" role="alert">
          <strong>Something went wrong:</strong> {{@error.message}}
          <button type="button" {{on "click" @onRetry}}>Try again</button>
        </div>
      {{else}}
        <div class="items-container items-container--{{@viewMode}}">
          {{#each @items as |item|}}
            <div class="item-card">
              {{#if item.coverUrl}}
                <img src={{item.coverUrl}} alt={{item.title}} class="item-card__cover" />
              {{/if}}
              <div class="item-card__body">
                <h2 class="item-card__title">
                  <a href={{item.url}}>{{item.title}}</a>
                </h2>
                <p class="item-card__meta">
                  <img
                    src={{item.author.avatarUrl}}
                    alt={{item.author.name}}
                    class="avatar avatar--xs"
                  />
                  {{item.author.name}}
                  {{#if item.publishedAt}}
                    · <time>{{item.publishedAt}}</time>
                  {{else}}
                    · <em>Draft</em>
                  {{/if}}
                </p>
                <p class="item-card__excerpt">{{item.excerpt}}</p>
                <ul class="item-card__tags">
                  {{#each item.tags as |tag|}}
                    <li class="tag">{{tag}}</li>
                  {{/each}}
                </ul>
              </div>
              <div class="item-card__footer">
                <span class="stat">
                  {{item.likeCount}} likes
                </span>
                <span class="stat">
                  {{item.commentCount}} comments
                </span>
                {{#if @currentUser}}
                  <button
                    type="button"
                    class="btn btn--icon {{if item.isLiked 'btn--liked'}}"
                    {{on "click" (fn @onLike item.id)}}
                    aria-label={{if item.isLiked "Unlike" "Like"}}
                  >
                    ♥
                  </button>
                {{/if}}
              </div>
            </div>
          {{else}}
            <p class="empty-state">
              No results found for <strong>{{@searchQuery}}</strong>.
              <button type="button" {{on "click" @onClearSearch}}>Clear search</button>
            </p>
          {{/each}}
        </div>

        {{#if @pagination}}
          <nav class="pagination" aria-label="Pagination">
            <button
              type="button"
              class="btn btn--sm"
              disabled={{@pagination.isFirstPage}}
              {{on "click" @onPrevPage}}
            >
              ← Previous
            </button>
            <span class="pagination__info">
              Page {{@pagination.currentPage}} of {{@pagination.totalPages}}
            </span>
            <button
              type="button"
              class="btn btn--sm"
              disabled={{@pagination.isLastPage}}
              {{on "click" @onNextPage}}
            >
              Next →
            </button>
          </nav>
        {{/if}}
      {{/if}}
    </main>
  </div>

  <footer class="app-footer">
    <p>© {{@year}} {{@appName}}. All rights reserved.</p>
    <nav class="footer-nav">
      {{#each @footerLinks as |link|}}
        <a href={{link.url}}>{{link.label}}</a>
      {{/each}}
    </nav>
  </footer>
</div>
`;

// ---------------------------------------------------------------------------
// Parse options (mirrors what ESLint passes at runtime)
// ---------------------------------------------------------------------------

const PARSE_OPTIONS = {
  comment: true,
  loc: true,
  range: true,
  tokens: true,
};

// ---------------------------------------------------------------------------
// Benchmarks
// ---------------------------------------------------------------------------

describe('gts parser', () => {
  bench('small file', () => {
    parseGjsGts(SMALL_GTS, { ...PARSE_OPTIONS, filePath: 'small.gts' });
  });

  bench('medium file', () => {
    parseGjsGts(MEDIUM_GTS, { ...PARSE_OPTIONS, filePath: 'medium.gts' });
  });

  bench('large file', () => {
    parseGjsGts(LARGE_GTS, { ...PARSE_OPTIONS, filePath: 'large.gts' });
  });
});

describe('gjs parser', () => {
  bench('small file', () => {
    parseGjsGts(SMALL_GJS, { ...PARSE_OPTIONS, filePath: 'small.gjs' });
  });

  bench('medium file', () => {
    parseGjsGts(MEDIUM_GJS, { ...PARSE_OPTIONS, filePath: 'medium.gjs' });
  });

  bench('large file', () => {
    parseGjsGts(LARGE_GJS, { ...PARSE_OPTIONS, filePath: 'large.gjs' });
  });
});

describe('hbs parser', () => {
  bench('small file', () => {
    parseHbs(SMALL_HBS, { ...PARSE_OPTIONS, filePath: 'small.hbs' });
  });

  bench('medium file', () => {
    parseHbs(MEDIUM_HBS, { ...PARSE_OPTIONS, filePath: 'medium.hbs' });
  });

  bench('large file', () => {
    parseHbs(LARGE_HBS, { ...PARSE_OPTIONS, filePath: 'large.hbs' });
  });
});
