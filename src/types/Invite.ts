import { IInvite } from './interfaces/IInvite';
import { App } from './App';
import { User } from './User';
import { FLAGS } from './UserPermissions';
import { Utils } from '../utils/Utils';
import { Core } from '..';

export class Invite implements IInvite {
  code: string;
  application: App;
  createdBy: User;
  claimedBy: User | null;
  expires: Date;

  #changes = false;
  #deleted = false;

  get format(): string {
    return `([Code ${this.code.split('-').slice(0, this.code.split('-').length - 1).join('-').replace(/[A-Z0-9]/gi, '#')}-${this.code.split('-').slice(this.code.split('-').length - 1, this.code.split('-').length).toString()}] [Inviter: ${this.createdBy.format}] ${this.claimedBy ? `[Claimer: ${this.claimedBy?.format}])` : `[Unclaimed]`}`;
  }

  setExpiration(expires: Date) {
    this.expires = expires;
    this.#changes = true;
  }

  save(auth: User): Promise<Invite> {
    return new Promise<Invite>((resolve, reject) => {
      if (this.#deleted)
        return reject('Invite does not exist');

			// If this is true, there are no changes to make
			if (!this.#changes)
				return resolve(this);

			// Make sure that they have permission
			else if (!auth?.permissions.has(FLAGS.MODIFY_INVITES, this.application.id) && this.application.owner.id != auth.id)
				return reject('Invalid permissions')

			// Make sure all the required fields are filled
			else if (!this.expires)
				return reject('Expires is required');

      // Run all the save commands
      Core.logger.debug(`Saving invite information for ${this.format}, auth: ${auth.format}`);
      Core.db.serialize(() => {
        // Update disable_reason
        Core.db.run('UPDATE invites SET expires_at = ? WHERE application_id = ? AND code = ?', [this.expires.getTime() / 1000, this.application.id, this.code], async () => {
          Core.logger.debug('Updated disable_reason');

          // Updates were saved
          this.#changes = false;

          // Return the updated user
          Core.logger.debug(`Saved invite information for ${this.format}`);
          return resolve(this);
        });
      });
    });
  }
  
  delete(auth: User): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!auth?.permissions.has(FLAGS.DELETE_INVITES, this.application.id))
        return reject('Invalid permissions');

      Core.db.run('DELETE FROM invites WHERE application_id = ? AND code = ?', [this.application.id, this.code], err => {
        if (err)
          return reject(err);

        this.#deleted = true;

        resolve();
      })
    })
  }

  static claim(app: App, code: string, user: User) {
    Core.db.run('UPDATE invites SET claimed_by = ? WHERE application_id = ? AND code = ?', [user.id, app.id, code]);
  }

  static #generateCode(app: App): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      let codeSegments = [];
      for (var x = 0;x < 3;x++)
        codeSegments.push(Utils.createString(5, true, true, false).toUpperCase());

      let code = codeSegments.join('-');

      Core.db.get('SELECT * FROM invites WHERE application_id = ? AND code = ?', [ app.id, code ], async (err, data) => {
        if (err)
          return reject(err);
        else if (data)
          return resolve(await this.#generateCode(app));

        return resolve(code);
      })
    })
  }

  static get(app: App, code: string): Promise<Invite> {
    return new Promise<Invite>((resolve, reject) => {
      Core.db.get('SELECT * FROM invites WHERE application_id = ? AND code = ?', [app.id, code], async (err, data) => {
        if (err)
          return reject(err);
        else if (!data)
          return reject('Unknown invite')

        return resolve(await this.fill(data));
      })
    })
  }

  static create(auth: User, app: App, user?: User, expires?: Date): Promise<Invite> {
    return new Promise<Invite>(async (resolve, reject) => {
      if (!auth?.permissions.has(FLAGS.CREATE_INVITES, app.id))
        return reject('Invalid permissions');

      let code = await this.#generateCode(app);
      Core.db.run('INSERT INTO invites (code, application_id, created_by, expires_at) VALUES (?, ?, ?, ?)', [ code, app.id, user?.id || auth?.id, (expires?.getDate() || 0) / 1000], async err => {
        if (err)
          return reject(err);

        return this.get(app, code).then(resolve).catch(reject);
      })
    })
  }

  static fill(data: any, createdBy?: User): Promise<Invite> {
    return new Promise<Invite>(async (resolve, _) => {
      var i = new this();
      i.code = data.code;
      i.application = await App.get(data.application_id);
      i.createdBy = createdBy || await User.get(data.created_by);
      i.claimedBy = data.claimed_by ? await User.get(data.claimed_by) : null;
      i.expires = new Date(data.expires_at * 1000);

      return resolve(i);
    })
  }
}