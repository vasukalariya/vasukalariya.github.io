---
layout: default
title: Home
---

# Here are some interesting reads

<div class="posts">
  {% for post in site.posts %}
    <article class="post">
      <h2>
        <a href="{{ post.url | relative_url }}">{{ post.title }}</a>
      </h2>
    </article>
  {% endfor %}
</div>

{% if site.posts.size == 0 %}
  <p>No posts yet. Check back soon!</p>
{% endif %}