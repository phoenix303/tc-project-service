/* eslint-disable no-unused-expressions */
/**
 * Tests for update.js
 */
import _ from 'lodash';
import chai from 'chai';
import request from 'supertest';
import sinon from 'sinon';

import models from '../../models';
import server from '../../app';
import testUtil from '../../tests/util';
import busApi from '../../services/busApi';
import { BUS_API_EVENT } from '../../constants';

const should = chai.should();

const body = {
  name: 'test project phase',
  description: 'test project phase description',
  requirements: 'test project phase requirements',
  status: 'active',
  startDate: '2018-05-15T00:00:00Z',
  endDate: '2018-05-15T12:00:00Z',
  budget: 20.0,
  progress: 1.23456,
  details: {
    message: 'This can be any json',
  },
  createdBy: 1,
  updatedBy: 1,
};

const updateBody = {
  name: 'test project phase xxx',
  description: 'test project phase description xxx',
  requirements: 'test project phase requirements xxx',
  status: 'inactive',
  startDate: '2018-05-11T00:00:00Z',
  endDate: '2018-05-12T12:00:00Z',
  budget: 123456.789,
  progress: 9.8765432,
  details: {
    message: 'This is another json',
  },
};

const validatePhase = (resJson, expectedPhase) => {
  should.exist(resJson);
  resJson.name.should.be.eql(expectedPhase.name);
  resJson.description.should.be.eql(expectedPhase.description);
  resJson.requirements.should.be.eql(expectedPhase.requirements);
  resJson.status.should.be.eql(expectedPhase.status);
  resJson.budget.should.be.eql(expectedPhase.budget);
  resJson.progress.should.be.eql(expectedPhase.progress);
  resJson.details.should.be.eql(expectedPhase.details);
};

describe('UPDATE work', () => {
  let projectId;
  let projectName;
  let workStreamId;
  let workId;
  let workId2;
  let workId3;

  const memberUser = {
    handle: testUtil.getDecodedToken(testUtil.jwts.member).handle,
    userId: testUtil.getDecodedToken(testUtil.jwts.member).userId,
    firstName: 'fname',
    lastName: 'lName',
    email: 'some@abc.com',
  };
  const copilotUser = {
    handle: testUtil.getDecodedToken(testUtil.jwts.copilot).handle,
    userId: testUtil.getDecodedToken(testUtil.jwts.copilot).userId,
    firstName: 'fname',
    lastName: 'lName',
    email: 'some@abc.com',
  };

  beforeEach((done) => {
    testUtil.clearDb()
      .then(() => {
        models.ProjectTemplate.create({
          name: 'template 2',
          key: 'key 2',
          category: 'category 2',
          icon: 'http://example.com/icon1.ico',
          question: 'question 2',
          info: 'info 2',
          aliases: ['key-2', 'key_2'],
          scope: {},
          phases: {},
          createdBy: 1,
          updatedBy: 2,
        })
        .then((template) => {
          models.WorkManagementPermission.create({
            policy: 'work.edit',
            permission: {
              allowRule: {
                projectRoles: ['customer', 'copilot'],
                topcoderRoles: ['Connect Manager', 'Connect Admin', 'administrator'],
              },
              denyRule: { projectRoles: ['copilot'] },
            },
            projectTemplateId: template.id,
            details: {},
            createdBy: 1,
            updatedBy: 1,
            lastActivityAt: 1,
            lastActivityUserId: '1',
          })
          .then(() => {
            // Create projects
            models.Project.create({
              type: 'generic',
              billingAccountId: 1,
              name: 'test1',
              description: 'test project1',
              status: 'draft',
              templateId: template.id,
              details: {},
              createdBy: 1,
              updatedBy: 1,
              lastActivityAt: 1,
              lastActivityUserId: '1',
            })
            .then((project) => {
              projectId = project.id;
              projectName = project.name;
              models.WorkStream.create({
                name: 'Work Stream',
                type: 'generic',
                status: 'active',
                projectId,
                createdBy: 1,
                updatedBy: 1,
              }).then((entity) => {
                workStreamId = entity.id;
                _.assign(body, { projectId });
                const createPhases = [
                  body,
                  _.assign({ order: 1 }, body),
                  _.assign({}, body, { status: 'draft' }),
                ];
                models.ProjectPhase.bulkCreate(createPhases, { returning: true }).then((phases) => {
                  workId = phases[0].id;
                  workId2 = phases[1].id;
                  workId3 = phases[2].id;
                  models.PhaseWorkStream.bulkCreate([{
                    phaseId: phases[0].id,
                    workStreamId,
                  }, {
                    phaseId: phases[1].id,
                    workStreamId,
                  }, {
                    phaseId: phases[2].id,
                    workStreamId,
                  }]).then(() => {
                    // create members
                    models.ProjectMember.bulkCreate([{
                      id: 1,
                      userId: copilotUser.userId,
                      projectId,
                      role: 'copilot',
                      isPrimary: false,
                      createdBy: 1,
                      updatedBy: 1,
                    }, {
                      id: 2,
                      userId: memberUser.userId,
                      projectId,
                      role: 'customer',
                      isPrimary: true,
                      createdBy: 1,
                      updatedBy: 1,
                    }]).then(() => done());
                  });
                });
              });
            });
          });
        });
      });
  });

  after(testUtil.clearDb);

  describe('PATCH /projects/{projectId}/workstreams/{workStreamId}/works/{workId}', () => {
    it('should return 403 if user is not authenticated', (done) => {
      request(server)
        .patch(`/v4/projects/${projectId}/workstreams/${workStreamId}/works/${workId}`)
        .send({ param: updateBody })
        .expect(403, done);
    });

    it('should return 403 for copilot', (done) => {
      request(server)
        .patch(`/v4/projects/${projectId}/workstreams/${workStreamId}/works/${workId}`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.copilot}`,
        })
        .send({ param: updateBody })
        .expect(403, done);
    });

    it('should return 404 when no work stream with specific workStreamId', (done) => {
      request(server)
        .patch(`/v4/projects/${projectId}/workstreams/999/works/${workId}`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.manager}`,
        })
        .send({ param: updateBody })
        .expect('Content-Type', /json/)
        .expect(404, done);
    });

    it('should return 404 when no work with specific workId', (done) => {
      request(server)
        .patch(`/v4/projects/${projectId}/workstreams/${workStreamId}/works/999`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.manager}`,
        })
        .send({ param: updateBody })
        .expect('Content-Type', /json/)
        .expect(404, done);
    });

    it('should return 422 when parameters are invalid', (done) => {
      request(server)
        .patch(`/v4/projects/${projectId}/workstreams/${workStreamId}/works/${workId}`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.manager}`,
        })
        .send({
          param: {
            progress: -15,
          },
        })
        .expect('Content-Type', /json/)
        .expect(422, done);
    });

    it('should return 400 when startDate > endDate', (done) => {
      request(server)
        .patch(`/v4/projects/${projectId}/workstreams/${workStreamId}/works/${workId}`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.manager}`,
        })
        .send({
          param: {
            endDate: '2018-05-13T00:00:00Z',
          },
        })
        .expect('Content-Type', /json/)
        .expect(400, done);
    });

    it('should return 200 for member', (done) => {
      request(server)
        .patch(`/v4/projects/${projectId}/workstreams/${workStreamId}/works/${workId}`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.member}`,
        })
        .send({ param: updateBody })
        .expect(200, done);
    });

    it('should return updated phase when user have permission and parameters are valid', (done) => {
      request(server)
        .patch(`/v4/projects/${projectId}/workstreams/${workStreamId}/works/${workId}`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.admin}`,
        })
        .send({ param: updateBody })
        .expect('Content-Type', /json/)
        .expect(200)
        .end((err, res) => {
          if (err) {
            done(err);
          } else {
            const resJson = res.body.result.content;
            validatePhase(resJson, updateBody);
            done();
          }
        });
    });

    it('should return updated phase when parameters are valid (0 for non -ve numbers)', (done) => {
      const bodyWithZeros = _.cloneDeep(updateBody);
      bodyWithZeros.duration = 0;
      bodyWithZeros.spentBudget = 0.0;
      bodyWithZeros.budget = 0.0;
      bodyWithZeros.progress = 0.0;
      request(server)
        .patch(`/v4/projects/${projectId}/workstreams/${workStreamId}/works/${workId}`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.admin}`,
        })
        .send({ param: bodyWithZeros })
        .expect('Content-Type', /json/)
        .expect(200)
        .end((err, res) => {
          if (err) {
            done(err);
          } else {
            const resJson = res.body.result.content;
            validatePhase(resJson, bodyWithZeros);
            done();
          }
        });
    });

    it('should return updated phase if the order is specified', (done) => {
      request(server)
        .patch(`/v4/projects/${projectId}/workstreams/${workStreamId}/works/${workId}`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.admin}`,
        })
        .send({ param: _.assign({ order: 1 }, updateBody) })
        .expect('Content-Type', /json/)
        .expect(200)
        .end((err, res) => {
          if (err) {
            done(err);
          } else {
            const resJson = res.body.result.content;
            validatePhase(resJson, updateBody);
            resJson.order.should.be.eql(1);

            // Check the order of the other phase
            models.ProjectPhase.findOne({ where: { id: workId2 } })
              .then((work2) => {
                work2.order.should.be.eql(2);
                done();
              });
          }
        });
    });

    describe('Bus api', () => {
      let createEventSpy;
      const sandbox = sinon.sandbox.create();

      before((done) => {
        // Wait for 500ms in order to wait for createEvent calls from previous tests to complete
        testUtil.wait(done);
      });

      beforeEach(() => {
        createEventSpy = sandbox.spy(busApi, 'createEvent');
      });

      afterEach(() => {
        sandbox.restore();
      });

      it('should NOT send message BUS_API_EVENT.PROJECT_PLAN_UPDATED when spentBudget updated', (done) => {
        request(server)
        .patch(`/v4/projects/${projectId}/workstreams/${workStreamId}/works/${workId}`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.admin}`,
        })
        .send({
          param: {
            spentBudget: 123,
          },
        })
        .expect('Content-Type', /json/)
        .expect(200)
        .end((err) => {
          if (err) {
            done(err);
          } else {
            testUtil.wait(() => {
              createEventSpy.calledOnce.should.be.true;

              createEventSpy.firstCall.calledWith(BUS_API_EVENT.PROJECT_WORK_UPDATE_PAYMENT);
              done();
            });
          }
        });
      });

      it('should NOT send message BUS_API_EVENT.PROJECT_PLAN_UPDATED when progress updated', (done) => {
        request(server)
        .patch(`/v4/projects/${projectId}/workstreams/${workStreamId}/works/${workId}`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.admin}`,
        })
        .send({
          param: {
            progress: 50,
          },
        })
        .expect('Content-Type', /json/)
        .expect(200)
        .end((err) => {
          if (err) {
            done(err);
          } else {
            testUtil.wait(() => {
              createEventSpy.callCount.should.be.eql(2);
              createEventSpy.firstCall.calledWith(BUS_API_EVENT.PROJECT_WORK_UPDATE_PROGRESS);
              createEventSpy.secondCall.calledWith(BUS_API_EVENT.PROJECT_PROGRESS_MODIFIED);
              done();
            });
          }
        });
      });

      it('should NOT send message BUS_API_EVENT.PROJECT_PLAN_UPDATED when details updated', (done) => {
        request(server)
        .patch(`/v4/projects/${projectId}/workstreams/${workStreamId}/works/${workId}`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.admin}`,
        })
        .send({
          param: {
            details: {
              text: 'something',
            },
          },
        })
        .expect('Content-Type', /json/)
        .expect(200)
        .end((err) => {
          if (err) {
            done(err);
          } else {
            testUtil.wait(() => {
              createEventSpy.calledOnce.should.be.true;
              createEventSpy.firstCall.calledWith(BUS_API_EVENT.PROJECT_WORK_UPDATE_SCOPE);
              done();
            });
          }
        });
      });

      it('should NOT send message BUS_API_EVENT.PROJECT_PLAN_UPDATED when status updated (active)', (done) => {
        request(server)
        .patch(`/v4/projects/${projectId}/workstreams/${workStreamId}/works/${workId3}`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.admin}`,
        })
        .send({
          param: {
            status: 'active',
          },
        })
        .expect('Content-Type', /json/)
        .expect(200)
        .end((err) => {
          if (err) {
            done(err);
          } else {
            testUtil.wait(() => {
              createEventSpy.calledOnce.should.be.true;
              createEventSpy.firstCall.calledWith(BUS_API_EVENT.PROJECT_WORK_TRANSITION_ACTIVE);
              done();
            });
          }
        });
      });

      it('should NOT send message BUS_API_EVENT.PROJECT_PLAN_UPDATED when status updated (completed)', (done) => {
        request(server)
        .patch(`/v4/projects/${projectId}/workstreams/${workStreamId}/works/${workId}`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.admin}`,
        })
        .send({
          param: {
            status: 'completed',
          },
        })
        .expect('Content-Type', /json/)
        .expect(200)
        .end((err) => {
          if (err) {
            done(err);
          } else {
            testUtil.wait(() => {
              createEventSpy.calledOnce.should.be.true;
              createEventSpy.firstCall.calledWith(BUS_API_EVENT.PROJECT_WORK_TRANSITION_COMPLETED);
              done();
            });
          }
        });
      });

      it('should NOT send message BUS_API_EVENT.PROJECT_PLAN_UPDATED when budget updated', (done) => {
        request(server)
        .patch(`/v4/projects/${projectId}/workstreams/${workStreamId}/works/${workId}`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.admin}`,
        })
        .send({
          param: {
            budget: 123,
          },
        })
        .expect('Content-Type', /json/)
        .expect(200)
        .end((err) => {
          if (err) {
            done(err);
          } else {
            testUtil.wait(() => {
              createEventSpy.notCalled.should.be.true;
              done();
            });
          }
        });
      });

      it('should send message BUS_API_EVENT.PROJECT_PLAN_UPDATED when startDate updated', (done) => {
        request(server)
        .patch(`/v4/projects/${projectId}/workstreams/${workStreamId}/works/${workId}`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.admin}`,
        })
        .send({
          param: {
            startDate: 123,
          },
        })
        .expect('Content-Type', /json/)
        .expect(200)
        .end((err) => {
          if (err) {
            done(err);
          } else {
            testUtil.wait(() => {
              createEventSpy.calledOnce.should.be.true;
              createEventSpy.calledWith(BUS_API_EVENT.PROJECT_PLAN_UPDATED, sinon.match({
                projectId,
                projectName,
                projectUrl: `https://local.topcoder-dev.com/projects/${projectId}`,
                // originalPhase: sinon.match(originalPhase),
                // updatedPhase: sinon.match(updatedPhase),
                userId: 40051333,
                initiatorUserId: 40051333,
              })).should.be.true;
              done();
            });
          }
        });
      });

      it('should send message BUS_API_EVENT.PROJECT_PLAN_UPDATED when duration updated', (done) => {
        request(server)
        .patch(`/v4/projects/${projectId}/workstreams/${workStreamId}/works/${workId}`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.admin}`,
        })
        .send({
          param: {
            duration: 100,
          },
        })
        .expect('Content-Type', /json/)
        .expect(200)
        .end((err) => {
          if (err) {
            done(err);
          } else {
            testUtil.wait(() => {
              createEventSpy.calledOnce.should.be.true;
              createEventSpy.calledWith(BUS_API_EVENT.PROJECT_PLAN_UPDATED, sinon.match({
                projectId,
                projectName,
                projectUrl: `https://local.topcoder-dev.com/projects/${projectId}`,
                userId: 40051333,
                initiatorUserId: 40051333,
              })).should.be.true;
              done();
            });
          }
        });
      });

      it('should not send message BUS_API_EVENT.PROJECT_PLAN_UPDATED when order updated', (done) => {
        request(server)
        .patch(`/v4/projects/${projectId}/workstreams/${workStreamId}/works/${workId}`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.admin}`,
        })
        .send({
          param: {
            order: 100,
          },
        })
        .expect('Content-Type', /json/)
        .expect(200)
        .end((err) => {
          if (err) {
            done(err);
          } else {
            testUtil.wait(() => {
              createEventSpy.notCalled.should.be.true;
              done();
            });
          }
        });
      });

      it('should not send message BUS_API_EVENT.PROJECT_PLAN_UPDATED when endDate updated', (done) => {
        request(server)
        .patch(`/v4/projects/${projectId}/workstreams/${workStreamId}/works/${workId}`)
        .set({
          Authorization: `Bearer ${testUtil.jwts.admin}`,
        })
        .send({
          param: {
            endDate: new Date(),
          },
        })
        .expect('Content-Type', /json/)
        .expect(200)
        .end((err) => {
          if (err) {
            done(err);
          } else {
            testUtil.wait(() => {
              createEventSpy.notCalled.should.be.true;
              done();
            });
          }
        });
      });
    });
  });
});
