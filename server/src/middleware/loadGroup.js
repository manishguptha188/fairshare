import { HttpError } from '../errors.js';
import { isObjectId } from '../lib/validation.js';
import { Group } from '../models/Group.js';

// Authorization for everything under /api/groups/:groupId. The query only matches a group the current user
// belongs to, so a non-member gets the same 404 as for a group that doesn't exist. Answering 403 instead
// would confirm to a stranger that the group id is real.
export async function loadGroup(req, res, next) {
  const { groupId } = req.params;
  const group = isObjectId(groupId) && (await Group.findOne({ _id: groupId, members: req.user._id }));
  if (!group) {
    throw new HttpError(404, 'Group not found.');
  }
  req.group = group;
  next();
}
