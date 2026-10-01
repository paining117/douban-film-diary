#!/bin/sh
# Installed as .git/hooks/pre-push in the consolidated local checkout.
# Only the separately sanitized public branch may go to this GitHub repository.
case "$2" in
  *github.com*paining117/douban-film-diary*) ;;
  *) exit 0 ;;
esac
while read local_ref local_sha remote_ref remote_sha; do
  if [ "$local_ref" != refs/heads/github-public ] || [ "$remote_ref" != refs/heads/main ]; then
    echo 'Push blocked: use git push github github-public:main; never push development main.' >&2
    exit 1
  fi
  if git show "$local_sha:.openai/hosting.json" | grep -q 'project_id'; then
    echo 'Push blocked: deployment project_id is present.' >&2
    exit 1
  fi
  for private_root in $(git rev-list --max-parents=0 main); do
    if git merge-base --is-ancestor "$private_root" "$local_sha"; then
      echo 'Push blocked: public branch includes private development history.' >&2
      exit 1
    fi
  done
done
