---
layout: default
title: Home
---

# Hello 👋

<div class="posts">
  {% for post in site.posts %}
    <article class="post">
      <h2>
        <a href="{{ post.url | relative_url }}">{{ post.title }}</a>
      </h2>
      <p class="post-meta">
        <time datetime="{{ post.date | date_to_xmlschema }}">
          {{ post.date | date: "%B %d, %Y" }}
        </time>
      </p>
    </article>
  {% endfor %}
</div>

{% if site.posts.size == 0 %}
  <p>No posts yet. Check back soon!</p>
{% endif %}